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
