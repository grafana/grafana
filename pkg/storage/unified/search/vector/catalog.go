package vector

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// ErrCollectionKindMismatch marks an EnsureCollection call whose
// internal/external flag disagrees with the catalog row. Handlers map it to
// NotFound so it stays indistinguishable from a collection that doesn't
// exist.
var ErrCollectionKindMismatch = errors.New("collection kind mismatch")

type CollectionScope string

const (
	ScopeTenant     CollectionScope = "tenant"
	ScopeShared     CollectionScope = "shared"
	SharedNamespace                 = "__SHARED__"
)

var ErrCollectionScopeMismatch = errors.New("collection scope mismatch")

// Collection is one row of the embedding_collections catalog: a (group,
// resource) pair provisioned for vector storage. The catalog does two
// things: maps resource names to partition keys (resource names may contain
// chars a table name can't, e.g. hyphens), and disambiguates same-named
// resources across groups (the partition name doesn't encode the group).
type Collection struct {
	Group        string // e.g. "dashboard.grafana.app"
	Resource     string // resource name as callers send it, e.g. "dashboards"
	PartitionKey string // value stored in embeddings.resource (LIST partition key)
	IsExternal   bool   // externally-pushed rows
	Scope        CollectionScope
}

// InternalPartitionKey lets enrollment validate partition names before any
// catalog or schema changes. Distinct resources may derive the same key;
// callers must also reject conflicting ownership.
func InternalPartitionKey(resource string) (string, error) {
	if resource == "" {
		return "", fmt.Errorf("internal resource must not be empty")
	}
	key := sanitizeIdentifier(resource)
	if isExternalPartitionKey(key) {
		return "", fmt.Errorf("internal resource %q derives reserved partition key %q (suffix _external); rename the resource", resource, key)
	}
	if len(key) > maxPartitionKeyLen {
		return "", fmt.Errorf("resource name %q too long: derived partition key %q exceeds %d chars", resource, key, maxPartitionKeyLen)
	}
	return key, nil
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
// resource can never share a partition with an external one. A resolve hit
// whose IsExternal disagrees with the caller's isExternal is rejected — a
// misconfigured allowlist entry must not let an external writer touch an
// internal collection. Only upsert paths call this — deletes resolve only,
// so they can't create empty collections.
func (b *pgvectorBackend) EnsureCollection(ctx context.Context, group, resource string, isExternal bool) (Collection, error) {
	return b.EnsureCollectionWithScope(ctx, group, resource, isExternal, ScopeTenant)
}

func (b *pgvectorBackend) EnsureCollectionWithScope(ctx context.Context, group, resource string, isExternal bool, scope CollectionScope) (Collection, error) {
	if group == "" || resource == "" {
		return Collection{}, fmt.Errorf("group and resource must not be empty")
	}
	if err := validateCollectionScope(scope, isExternal); err != nil {
		return Collection{}, err
	}
	c, found, err := b.ResolveCollection(ctx, group, resource)
	if err != nil {
		return Collection{}, err
	}
	if found {
		if c.Scope != scope {
			return Collection{}, fmt.Errorf("collection %s/%s has scope %q, requested %q: %w", group, resource, c.Scope, scope, ErrCollectionScopeMismatch)
		}
		if c.IsExternal != isExternal {
			if isExternal {
				return Collection{}, fmt.Errorf("collection %s/%s is internal, not writable through the external API: %w", group, resource, ErrCollectionKindMismatch)
			}
			return Collection{}, fmt.Errorf("collection %s/%s is external, not writable through the internal API: %w", group, resource, ErrCollectionKindMismatch)
		}
		// Re-check on every call, not just first provision: a prior insert may
		// have committed while the partition DDL failed transiently, which
		// would otherwise wedge the collection forever (resolve keeps
		// succeeding, DDL never runs again). Cheap once the partition exists.
		if err := b.EnsureResourcePartition(ctx, c.PartitionKey); err != nil {
			return Collection{}, err
		}
		return c, nil
	}

	key := sanitizeIdentifier(resource)
	if isExternal {
		key += "_external"
		if len(key) > maxPartitionKeyLen {
			return Collection{}, fmt.Errorf("resource name %q too long: derived partition key %q exceeds %d chars", resource, key, maxPartitionKeyLen)
		}
	} else {
		key, err = InternalPartitionKey(resource)
		if err != nil {
			return Collection{}, err
		}
	}

	_, err = dbutil.Exec(ctx, b.db, sqlVectorCatalogInsert, &sqlVectorCatalogInsertRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		GroupName:    group,
		Resource:     resource,
		PartitionKey: key,
		IsExternal:   isExternal,
		Scope:        scope,
	})
	if err != nil {
		// UNIQUE(partition_key) may race with another provisioner. An exact
		// owner is safe to re-resolve; a different owner needs an explicit
		// error because partition keys cannot be shared.
		owner, ok, oerr := b.collectionByPartitionKey(ctx, key)
		if oerr == nil && ok && owner.Group == group && owner.Resource == resource {
			// A concurrent provisioner won this exact catalog row. The
			// re-resolve below still checks scope before creating its leaf.
		} else if oerr == nil && ok {
			return Collection{}, fmt.Errorf(
				"provision collection %s/%s: derived partition key %q is already owned by %s/%s; the new collection needs a manually assigned partition key",
				group, resource, key, owner.Group, owner.Resource)
		} else {
			return Collection{}, fmt.Errorf("provision collection %s/%s: %w", group, resource, err)
		}
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
	if c.Scope != scope || c.IsExternal != isExternal {
		return Collection{}, fmt.Errorf("collection %s/%s changed kind or scope during provisioning: %w", group, resource, ErrCollectionScopeMismatch)
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
	_, ok, err := b.collectionByPartitionKey(ctx, key)
	return ok, err
}

func (b *pgvectorBackend) collectionByPartitionKey(ctx context.Context, key string) (Collection, bool, error) {
	collections, err := b.listCollections(ctx)
	if err != nil {
		return Collection{}, false, err
	}
	for _, c := range collections {
		if c.PartitionKey == key {
			return c, true, nil
		}
	}
	return Collection{}, false, nil
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
		if err := validateCollectionScope(CollectionScope(r.Scope), r.IsExternal); err != nil {
			return nil, fmt.Errorf("collection %s/%s: %w", r.GroupName, r.Resource, err)
		}
		out = append(out, Collection{
			Group:        r.GroupName,
			Resource:     r.Resource,
			PartitionKey: r.PartitionKey,
			IsExternal:   r.IsExternal,
			Scope:        CollectionScope(r.Scope),
		})
	}
	return out, nil
}

func validateCollectionScope(scope CollectionScope, isExternal bool) error {
	if scope != ScopeTenant && scope != ScopeShared {
		return fmt.Errorf("invalid collection scope %q", scope)
	}
	if scope == ScopeShared && !isExternal {
		return fmt.Errorf("shared scope requires an external collection")
	}
	return nil
}
