package vector

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Collection is one row of the embedding_collections catalog: a wire-level
// (group, resource) pair provisioned for vector storage. A pair with no
// catalog row is not addressable — callers surface NOT_FOUND.
type Collection struct {
	Group        string
	Resource     string // wire-level resource name, e.g. "infra-memories"
	PartitionKey string // value stored in embeddings.resource (LIST partition key)
	IsExternal   bool   // externally-pushed rows; reads skip per-result authz
}

// collectionCatalogTTL bounds how stale the in-process catalog snapshot can
// get. Rows change rarely (provisioning is an operator INSERT), so a minute
// keeps lookups off the DB without needing invalidation plumbing.
const collectionCatalogTTL = time.Minute

type catalogWireKey struct{ group, resource string }

type catalogSnapshot struct {
	byWire        map[catalogWireKey]Collection
	partitionKeys map[string]struct{}
	loaded        time.Time
}

func (b *pgvectorBackend) ResolveCollection(ctx context.Context, group, resource string) (Collection, bool, error) {
	snap, err := b.catalogSnapshot(ctx)
	if err != nil {
		return Collection{}, false, err
	}
	c, ok := snap.byWire[catalogWireKey{group, resource}]
	return c, ok, nil
}

// hasPartitionKey reports whether any catalog row owns the given partition
// key. Internal callers (reconciler, backfill) work in partition keys
// directly, so validateResource checks this side of the mapping.
func (b *pgvectorBackend) hasPartitionKey(ctx context.Context, key string) (bool, error) {
	snap, err := b.catalogSnapshot(ctx)
	if err != nil {
		return false, err
	}
	_, ok := snap.partitionKeys[key]
	return ok, nil
}

// catalogSnapshot returns the cached catalog, reloading it when older than
// collectionCatalogTTL. The lock is held across the reload — the table is a
// handful of rows and this keeps refreshes single-flight. A failed refresh
// serves the previous snapshot rather than failing requests.
func (b *pgvectorBackend) catalogSnapshot(ctx context.Context) (*catalogSnapshot, error) {
	b.catalogMu.Lock()
	defer b.catalogMu.Unlock()
	if b.catalog != nil && time.Since(b.catalog.loaded) < collectionCatalogTTL {
		return b.catalog, nil
	}
	collections, err := b.listCollections(ctx)
	if err != nil {
		if b.catalog != nil {
			b.log.Warn("collection catalog refresh failed, serving stale snapshot", "err", err)
			return b.catalog, nil
		}
		return nil, err
	}
	snap := &catalogSnapshot{
		byWire:        make(map[catalogWireKey]Collection, len(collections)),
		partitionKeys: make(map[string]struct{}, len(collections)),
		loaded:        time.Now(),
	}
	for _, c := range collections {
		snap.byWire[catalogWireKey{c.Group, c.Resource}] = c
		snap.partitionKeys[c.PartitionKey] = struct{}{}
	}
	b.catalog = snap
	return snap, nil
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
