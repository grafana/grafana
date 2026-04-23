package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ VectorBackend = (*pgvectorBackend)(nil)

type pgvectorBackend struct {
	db          db.DB
	dialect     sqltemplate.Dialect
	collections sync.Map
	log         log.Logger
}

// collectionKey identifies a single per-collection table in the cache.
type collectionKey struct {
	namespace    string
	model        string
	collectionID string // group/resource for unified storage resources
}

func NewPgvectorBackend(database db.DB) *pgvectorBackend {
	return &pgvectorBackend{
		db:      database,
		dialect: sqltemplate.PostgreSQL,
		log:     log.New("vector-pgvector"),
	}
}

func (b *pgvectorBackend) Upsert(ctx context.Context, vectors []Vector) error {
	if len(vectors) == 0 {
		return nil
	}

	// Validate before any DB work so a single bad vector fails the whole
	// batch loud, not silently in SQL.
	for i := range vectors {
		if err := vectors[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
	}

	// Group vectors by collection so each group lands in a single table, and
	// compute the batch-wide max RV to bump the global checkpoint with a
	// single UPDATE at the end of the tx.
	byCollection := make(map[collectionKey][]Vector)
	var batchMaxRV int64
	for i := range vectors {
		key := collectionKey{
			namespace:    vectors[i].Namespace,
			model:        vectors[i].Model,
			collectionID: vectors[i].CollectionID,
		}
		byCollection[key] = append(byCollection[key], vectors[i])
		if vectors[i].ResourceVersion > batchMaxRV {
			batchMaxRV = vectors[i].ResourceVersion
		}
	}

	// Track freshly-resolved tables so we can cache them after the tx commits.
	// Caching before commit would be unsafe: a rolled-back tx means the table
	// may not actually exist yet, so subsequent writes would hit INSERT into a
	// non-existent table.
	type resolved struct {
		key  collectionKey
		name string
	}
	var freshlyResolved []resolved

	err := b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		freshlyResolved = freshlyResolved[:0]
		for key, vecs := range byCollection {
			table, fresh, err := b.resolveCollection(ctx, tx, key)
			if err != nil {
				return fmt.Errorf("resolve collection %q/%q/%q: %w", key.namespace, key.model, key.collectionID, err)
			}
			if fresh {
				freshlyResolved = append(freshlyResolved, resolved{key, table})
			}
			for i := range vecs {
				req := &sqlVectorCollectionUpsertRequest{
					SQLTemplate: sqltemplate.New(b.dialect),
					Table:       table,
					Vector:      &vecs[i],
					Embedding:   pgvector.NewHalfVector(vecs[i].Embedding),
				}
				if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionUpsert, req); err != nil {
					return fmt.Errorf("upsert vector %s/%s: %w", vecs[i].Name, vecs[i].Subresource, err)
				}
			}
		}
		// Bump the global checkpoint in the same tx. Monotonic — never moves
		// backwards. WHERE latest_rv < $1 also makes the UPDATE a no-op when
		// we'd be lowering it, which skips the write lock entirely.
		if batchMaxRV > 0 {
			if _, err := tx.ExecContext(ctx,
				`UPDATE vector_latest_rv SET latest_rv = $1 WHERE id = 1 AND latest_rv < $1`,
				batchMaxRV,
			); err != nil {
				return fmt.Errorf("bump vector_latest_rv: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	for _, r := range freshlyResolved {
		b.collections.Store(r.key, r.name)
	}
	return nil
}

// Delete removes every row for a resource within a specific collection.
// Used when a resource is hard-deleted from storage. model must be non-empty.
func (b *pgvectorBackend) Delete(ctx context.Context, namespace, model, collectionID, name string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	table, ok, err := b.lookupCollection(ctx, collectionKey{namespace, model, collectionID})
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	req := &sqlVectorCollectionDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Table:       table,
		Name:        name,
	}
	_, err = dbutil.Exec(ctx, b.db, sqlVectorCollectionDelete, req)
	return err
}

// DeleteSubresources removes a specific set of subresources for `name` in a
// collection. Used for stale cleanup after a resource update removes some of
// its subresources. model must be non-empty. Empty subresources is a no-op.
func (b *pgvectorBackend) DeleteSubresources(ctx context.Context, namespace, model, collectionID, name string, subresources []string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if len(subresources) == 0 {
		return nil
	}
	table, ok, err := b.lookupCollection(ctx, collectionKey{namespace, model, collectionID})
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	req := &sqlVectorCollectionDeleteSubresourcesRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Table:        table,
		Name:         name,
		Subresources: subresources,
	}
	_, err = dbutil.Exec(ctx, b.db, sqlVectorCollectionDeleteSubresource, req)
	return err
}

// GetCurrentContent returns (subresource -> content) for every row stored
// under (namespace, model, collectionID, name). Miss returns nil map, no
// error. Callers compare against candidate content and only re-embed what
// differs.
func (b *pgvectorBackend) GetCurrentContent(ctx context.Context, namespace, model, collectionID, name string) (map[string]string, error) {
	table, ok, err := b.lookupCollection(ctx, collectionKey{namespace, model, collectionID})
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	req := &sqlVectorCollectionGetContentRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Table:       table,
		Name:        name,
		Response:    &sqlVectorCollectionGetContentResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionGetContent, req)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.Subresource] = r.Content
	}
	return out, nil
}

func (b *pgvectorBackend) Search(ctx context.Context, namespace, model, collectionID string,
	embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error) {
	table, ok, err := b.lookupCollection(ctx, collectionKey{namespace, model, collectionID})
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}

	req := &sqlVectorCollectionSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Table:          table,
		QueryEmbedding: pgvector.NewHalfVector(embedding),
		Limit:          int64(limit),
		Response:       &sqlVectorCollectionSearchResponse{},
	}

	for _, f := range filters {
		switch f.Field {
		case "name":
			req.NameValues = f.Values
		case "folder":
			req.FolderValues = f.Values
		default:
			// Generic JSONB containment filter: metadata @> '{"field": ["v1","v2"]}'
			j, _ := json.Marshal(map[string][]string{f.Field: f.Values})
			req.MetadataFilters = append(req.MetadataFilters, MetadataFilterEntry{JSON: string(j)})
		}
	}

	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionSearch, req)
	if err != nil {
		return nil, err
	}

	results := make([]VectorSearchResult, len(rows))
	for i, row := range rows {
		results[i] = VectorSearchResult{
			Name:        row.Name,
			Subresource: row.Subresource,
			Content:     row.Content,
			Score:       row.Score,
			Folder:      row.Folder,
			Metadata:    row.Metadata,
		}
	}
	return results, nil
}

// GetLatestRV reads the single-row global checkpoint. O(1) — no dependency on
// collection count. The row is seeded with latest_rv=0 at migration time and
// bumped on every Upsert that carries a higher RV.
//
// Note: this is unified-storage-specific. Once non-unified-storage vectors are
// stored here, a global single-valued checkpoint stops making sense and this
// method goes away in favor of per-source checkpoints.
func (b *pgvectorBackend) GetLatestRV(ctx context.Context) (int64, error) {
	var rv int64
	err := b.db.QueryRowContext(ctx,
		`SELECT latest_rv FROM vector_latest_rv WHERE id = 1`).Scan(&rv)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Seed row missing (shouldn't happen post-migration). Treat as 0
			// rather than erroring — matches the empty-backend semantics.
			return 0, nil
		}
		return 0, fmt.Errorf("read vector_latest_rv: %w", err)
	}
	return rv, nil
}

// resolveCollection ensures the catalog row and per-collection table exist for
// the given key, returning the table name. The caller must provide a tx so
// that catalog insert, advisory lock, and CREATE TABLE run atomically; the
// advisory lock is transaction-scoped and prevents concurrent first-writers
// from racing on pg_class.
//
// The returned `fresh` flag is true when we went through the catalog/DDL path
// (as opposed to a cache hit). Callers should cache the (key → table) mapping
// ONLY after the outer transaction commits — caching before commit risks
// desync if the tx rolls back.
func (b *pgvectorBackend) resolveCollection(ctx context.Context, tx db.Tx, key collectionKey) (string, bool, error) {
	if cached, ok := b.collections.Load(key); ok {
		return cached.(string), false, nil
	}

	// Upsert the catalog row. ON CONFLICT DO NOTHING covers the case where a
	// concurrent tx inserted first; the SELECT that follows returns the
	// existing id in either case.
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO vector_collections (namespace, model, collection_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		key.namespace, key.model, key.collectionID); err != nil {
		return "", false, fmt.Errorf("insert vector_collections: %w", err)
	}

	var id int64
	if err := tx.QueryRowContext(ctx,
		`SELECT id FROM vector_collections WHERE namespace = $1 AND model = $2 AND collection_id = $3`,
		key.namespace, key.model, key.collectionID,
	).Scan(&id); err != nil {
		return "", false, fmt.Errorf("select vector_collections id: %w", err)
	}
	table := fmt.Sprintf("vec_%d", id)

	// Advisory lock keyed on the table name hash. Serializes concurrent
	// first-writers so exactly one session runs the CREATE TABLE path;
	// others wait, then observe the table via IF NOT EXISTS. Released on
	// tx commit/rollback.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, table); err != nil {
		return "", false, fmt.Errorf("advisory lock on %s: %w", table, err)
	}

	req := &sqlVectorCollectionCreateTableRequest{
		SQLTemplate:       sqltemplate.New(b.dialect),
		Table:             table,
		HNSWIndexName:     table + "_hnsw",
		MetadataIndexName: table + "_metadata",
	}
	if err := req.Validate(); err != nil {
		return "", false, err
	}
	query, err := sqltemplate.Execute(sqlVectorCollectionCreateTable, req)
	if err != nil {
		return "", false, fmt.Errorf("render create-table DDL: %w", err)
	}
	if _, err := tx.ExecContext(ctx, query); err != nil {
		return "", false, fmt.Errorf("create collection table %s: %w", table, err)
	}

	return table, true, nil
}

// lookupCollection reads the catalog to resolve the table name for a key, if
// it exists. Returns (table, true) on hit, ("", false) on miss — miss is not
// an error, it just means no data has ever been written for this key.
//
// Used by read paths (Search, Delete): they should not create tables.
func (b *pgvectorBackend) lookupCollection(ctx context.Context, key collectionKey) (string, bool, error) {
	if cached, ok := b.collections.Load(key); ok {
		return cached.(string), true, nil
	}
	var id int64
	err := b.db.QueryRowContext(ctx,
		`SELECT id FROM vector_collections WHERE namespace = $1 AND model = $2 AND collection_id = $3`,
		key.namespace, key.model, key.collectionID,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", false, nil
		}
		return "", false, fmt.Errorf("lookup vector_collections: %w", err)
	}
	table := fmt.Sprintf("vec_%d", id)
	b.collections.Store(key, table)
	return table, true, nil
}

