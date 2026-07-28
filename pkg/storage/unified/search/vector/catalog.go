package vector

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Collection is one row of the embedding_collections catalog: a (group,
// resource) pair provisioned for vector storage. The catalog does two
// things: maps resource names to partition keys (resource names may contain
// chars a table name can't, e.g. hyphens), and disambiguates same-named
// resources across groups (the partition name doesn't encode the group).
type Collection struct {
	Group        string // e.g. "dashboard.grafana.app"
	Resource     string // resource name as callers send it, e.g. "dashboards"
	PartitionKey string // value stored in embeddings.resource (LIST partition key)
	IsExternal   bool   // externally-pushed rows; reads skip per-result authz
}

func (b *pgvectorBackend) ResolveCollection(ctx context.Context, group, resource string) (Collection, bool, error) {
	collections, err := b.listCollections(ctx)
	if err != nil {
		return Collection{}, false, err
	}
	for _, c := range collections {
		if c.Group == group && c.Resource == resource {
			return c, true, nil
		}
	}
	return Collection{}, false, nil
}

// EnsureCollection resolves (group, resource), provisioning it on first use:
// derive the partition key, insert the catalog row (race-safe), and create
// the partition leaf. External keys get "_external" appended so an internal
// resource can never share a partition with an external one. Only upsert
// paths call this — deletes resolve only, so they can't create empty
// collections.
func (b *pgvectorBackend) EnsureCollection(ctx context.Context, group, resource string, isExternal bool) (Collection, error) {
	if group == "" || resource == "" {
		return Collection{}, fmt.Errorf("group and resource must not be empty")
	}
	c, found, err := b.ResolveCollection(ctx, group, resource)
	if err != nil {
		return Collection{}, err
	}
	if found {
		return c, nil
	}

	key := sanitizeIdentifier(resource)
	if isExternal {
		key += "_external"
	}
	if len(key) > maxPartitionKeyLen {
		return Collection{}, fmt.Errorf("resource name %q too long: derived partition key %q exceeds %d chars", resource, key, maxPartitionKeyLen)
	}

	_, err = dbutil.Exec(ctx, b.db, sqlVectorCatalogInsert, &sqlVectorCatalogInsertRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		GroupName:    group,
		Resource:     resource,
		PartitionKey: key,
		IsExternal:   isExternal,
	})
	if err != nil {
		// A UNIQUE(partition_key) violation means a different (group,
		// resource) already owns this key — surface it for manual fixup.
		return Collection{}, fmt.Errorf("provision collection %s/%s: %w", group, resource, err)
	}

	// Re-resolve: ON CONFLICT DO NOTHING means a concurrent provisioner may
	// have won the insert — either way the row exists now.
	c, found, err = b.ResolveCollection(ctx, group, resource)
	if err != nil {
		return Collection{}, err
	}
	if !found {
		return Collection{}, fmt.Errorf("provision collection %s/%s: catalog row missing after insert (partition key %q taken?)", group, resource, key)
	}

	if err := b.EnsureResourcePartition(ctx, c.PartitionKey); err != nil {
		return Collection{}, err
	}
	return c, nil
}

// hasPartitionKey reports whether any catalog row owns the given partition
// key. Internal callers (reconciler, backfill) work in partition keys
// directly, so validateResource checks this side of the mapping.
func (b *pgvectorBackend) hasPartitionKey(ctx context.Context, key string) (bool, error) {
	collections, err := b.listCollections(ctx)
	if err != nil {
		return false, err
	}
	for _, c := range collections {
		if c.PartitionKey == key {
			return true, nil
		}
	}
	return false, nil
}

func (b *pgvectorBackend) listCollections(ctx context.Context) ([]Collection, error) {
	req := &sqlVectorCatalogListRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Response:    &sqlVectorCatalogListResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlVectorCatalogList, req)
	if err != nil {
		return nil, fmt.Errorf("list embedding collections: %w", err)
	}
	out := make([]Collection, 0, len(rows))
	for _, r := range rows {
		out = append(out, Collection{
			Group:        r.GroupName,
			Resource:     r.Resource,
			PartitionKey: r.PartitionKey,
			IsExternal:   r.IsExternal,
		})
	}
	return out, nil
}
