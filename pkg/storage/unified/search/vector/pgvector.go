package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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

// NewPgvectorBackend builds a VectorBackend. `promoterInterval=0` leaves the
// promoter idle — safe on any target; schema-owning targets call Run.
func NewPgvectorBackend(database db.DB, promotionThreshold int, promoterInterval time.Duration) *pgvectorBackend {
	return &pgvectorBackend{
		db:       database,
		dialect:  sqltemplate.PostgreSQL,
		log:      log.New("vector-pgvector"),
		promoter: NewPromoter(database, promotionThreshold, promoterInterval),
	}
}

func (b *pgvectorBackend) Run(ctx context.Context) error {
	return b.promoter.Run(ctx)
}

// validateResource rejects resources that don't have a sub-tree attached.
// Adding a resource means attaching an `embeddings_<R>` sub-tree.
func validateResource(resource string) error {
	switch resource {
	case "dashboards":
		return nil
	default:
		return fmt.Errorf("unsupported resource %q (no embeddings sub-tree provisioned)", resource)
	}
}

func (b *pgvectorBackend) Upsert(ctx context.Context, vectors []Vector) error {
	if len(vectors) == 0 {
		return nil
	}

	for i := range vectors {
		if err := vectors[i].Validate(); err != nil {
			return fmt.Errorf("vector[%d]: %w", i, err)
		}
	}

	var batchMaxRV int64
	for i := range vectors {
		if vectors[i].ResourceVersion > batchMaxRV {
			batchMaxRV = vectors[i].ResourceVersion
		}
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		for i := range vectors {
			if err := validateResource(vectors[i].Resource); err != nil {
				return fmt.Errorf("vector[%d]: %w", i, err)
			}
			req := &sqlVectorCollectionUpsertRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Resource:    vectors[i].Resource,
				Vector:      &vectors[i],
				Embedding:   pgvector.NewHalfVector(vectors[i].Embedding),
			}
			if _, err := dbutil.Exec(ctx, tx, sqlVectorCollectionUpsert, req); err != nil {
				return fmt.Errorf("upsert vector %s/%s: %w", vectors[i].UID, vectors[i].Subresource, err)
			}
		}

		// WHERE clause keeps this monotonic under concurrent writers.
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

func (b *pgvectorBackend) Delete(ctx context.Context, namespace, model, resource, uid string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if err := validateResource(resource); err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorCollectionDelete, req)
	return err
}

func (b *pgvectorBackend) DeleteSubresources(ctx context.Context, namespace, model, resource, uid string, subresources []string) error {
	if model == "" {
		return fmt.Errorf("model must not be empty")
	}
	if len(subresources) == 0 {
		return nil
	}
	if err := validateResource(resource); err != nil {
		return err
	}
	req := &sqlVectorCollectionDeleteSubresourcesRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Resource:     resource,
		Namespace:    namespace,
		Model:        model,
		UID:          uid,
		Subresources: subresources,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlVectorCollectionDeleteSubresource, req)
	return err
}

func (b *pgvectorBackend) GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, error) {
	if err := validateResource(resource); err != nil {
		return nil, err
	}
	req := &sqlVectorCollectionGetContentRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    resource,
		Namespace:   namespace,
		Model:       model,
		UID:         uid,
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

func (b *pgvectorBackend) Search(ctx context.Context, namespace, model, resource string,
	embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error) {
	if err := validateResource(resource); err != nil {
		return nil, err
	}

	req := &sqlVectorCollectionSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Resource:       resource,
		Namespace:      namespace,
		Model:          model,
		QueryEmbedding: pgvector.NewHalfVector(embedding),
		Limit:          int64(limit),
		Response:       &sqlVectorCollectionSearchResponse{},
	}

	for _, f := range filters {
		switch f.Field {
		case "uid":
			req.UIDValues = f.Values
		case "folder":
			req.FolderValues = f.Values
		default:
			// JSONB containment: metadata @> '{"field":["v1","v2"]}'
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
			UID:         row.UID,
			Title:       row.Title,
			Subresource: row.Subresource,
			Content:     row.Content,
			Score:       row.Score,
			Folder:      row.Folder,
			Metadata:    row.Metadata,
		}
	}
	return results, nil
}

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
