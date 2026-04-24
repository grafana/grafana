package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ VectorBackend = (*pgvectorBackend)(nil)

type pgvectorBackend struct {
	db       db.DB
	dialect  sqltemplate.Dialect
	log      log.Logger
	promoter *Promoter
}

// NewPgvectorBackend builds a VectorBackend backed by pgvector. The backend
// owns its own Promoter; call Run(ctx) on a target that owns the vector
// schema to start the background promotion loop. `interval=0` leaves the
// promoter idle — safe to call on any target.
func NewPgvectorBackend(database db.DB, promotionThreshold int, promoterInterval time.Duration) *pgvectorBackend {
	return &pgvectorBackend{
		db:       database,
		dialect:  sqltemplate.PostgreSQL,
		log:      log.New("vector-pgvector"),
		promoter: NewPromoter(database, promotionThreshold, promoterInterval),
	}
}

// Run starts the background promotion loop and blocks until ctx is cancelled.
// Returns once ctx is done; interval=0 keeps it idle without issuing DDL.
func (b *pgvectorBackend) Run(ctx context.Context) error {
	return b.promoter.Run(ctx)
}

// tableForCollection maps a CollectionID ("<group>/<resource>") to the
// partitioned parent table for that resource. MVP supports dashboards only;
// adding more resources = adding cases here (and a migration for each new
// parent table).
func tableForCollection(collectionID string) (string, error) {
	resource := collectionID
	if i := strings.LastIndex(collectionID, "/"); i >= 0 {
		resource = collectionID[i+1:]
	}
	switch resource {
	case "dashboards":
		return "dashboard_embeddings", nil
	default:
		return "", fmt.Errorf("unsupported resource %q (no embeddings table provisioned)", resource)
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

	// Batch-wide max RV: bump the global checkpoint once at the end of the tx.
	var batchMaxRV int64
	for i := range vectors {
		if vectors[i].ResourceVersion > batchMaxRV {
			batchMaxRV = vectors[i].ResourceVersion
		}
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		for i := range vectors {
			table, err := tableForCollection(vectors[i].CollectionID)
			if err != nil {
				return fmt.Errorf("vector[%d]: %w", i, err)
			}
			req := &sqlVectorCollectionUpsertRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Table:       table,
				Vector:      &vectors[i],
				Embedding:   pgvector.NewHalfVector(vectors[i].Embedding),
			}
			if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionUpsert, req); err != nil {
				return fmt.Errorf("upsert vector %s/%s: %w", vectors[i].Name, vectors[i].Subresource, err)
			}
		}

		// Monotonic; WHERE clause makes backwards UPDATE a no-op.
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
}

// Delete removes every row for a resource `name` in the (namespace, model)
// collection. Used when a resource is hard-deleted from storage.
func (b *pgvectorBackend) Delete(ctx context.Context, namespace, model, collectionID, name string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	table, err := tableForCollection(collectionID)
	if err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Table:       table,
		Namespace:   namespace,
		Model:       model,
		Name:        name,
	}
	_, err = dbutil.Exec(ctx, b.db, sqlVectorCollectionDelete, req)
	return err
}

// DeleteSubresources removes a specific set of subresources for `name`.
func (b *pgvectorBackend) DeleteSubresources(ctx context.Context, namespace, model, collectionID, name string, subresources []string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if len(subresources) == 0 {
		return nil
	}
	table, err := tableForCollection(collectionID)
	if err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteSubresourcesRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Table:        table,
		Namespace:    namespace,
		Model:        model,
		Name:         name,
		Subresources: subresources,
	}
	_, err = dbutil.Exec(ctx, b.db, sqlVectorCollectionDeleteSubresource, req)
	return err
}

// GetSubresourceContent returns (subresource -> content) for every row stored
// under (namespace, model, collectionID, name). Callers compare against
// candidate content and only re-embed what differs.
func (b *pgvectorBackend) GetSubresourceContent(ctx context.Context, namespace, model, collectionID, name string) (map[string]string, error) {
	table, err := tableForCollection(collectionID)
	if err != nil {
		return nil, err
	}
	req := &sqlVectorCollectionGetContentRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Table:       table,
		Namespace:   namespace,
		Model:       model,
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
	table, err := tableForCollection(collectionID)
	if err != nil {
		return nil, err
	}

	req := &sqlVectorCollectionSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Table:          table,
		Namespace:      namespace,
		Model:          model,
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

// GetLatestRV reads the single-row global checkpoint. O(1).
func (b *pgvectorBackend) GetLatestRV(ctx context.Context) (int64, error) {
	var rv int64
	row := b.db.QueryRowContext(ctx, `SELECT latest_rv FROM vector_latest_rv WHERE id = 1`)
	if err := row.Scan(&rv); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("read vector_latest_rv: %w", err)
	}
	return rv, nil
}
