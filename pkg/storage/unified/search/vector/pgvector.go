package vector

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ VectorBackend = (*pgvectorBackend)(nil)

	// sanitizeRe replaces non-alphanumeric characters with underscores for partition names.
	sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9]`)
)

type pgvectorBackend struct {
	db         db.DB
	dialect    sqltemplate.Dialect
	partitions sync.Map // partitionKey -> struct{}
	log        log.Logger
}

// partitionKey identifies a single (namespace, model) partition in the
// pgvectorBackend's partition-existence cache.
type partitionKey struct {
	namespace string
	model     string
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

	// Group by (namespace, model) so each group lands in a single partition.
	byPartition := make(map[partitionKey][]Vector)
	for i := range vectors {
		key := partitionKey{namespace: vectors[i].Namespace, model: vectors[i].Model}
		byPartition[key] = append(byPartition[key], vectors[i])
	}

	return b.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		for key, vecs := range byPartition {
			if err := b.ensurePartition(ctx, tx, key); err != nil {
				return fmt.Errorf("ensure partition for %q/%q: %w", key.namespace, key.model, err)
			}
			for i := range vecs {
				req := &sqlEmbeddingsUpsertRequest{
					SQLTemplate: sqltemplate.New(b.dialect),
					Vector:      &vecs[i],
					Embedding:   pgvector.NewHalfVector(vecs[i].Embedding),
				}
				if _, err := dbutil.Exec(ctx, tx, sqlEmbeddingsUpsert, req); err != nil {
					return fmt.Errorf("upsert vector %s/%s: %w", vecs[i].Name, vecs[i].Subresource, err)
				}
			}
		}
		return nil
	})
}

func (b *pgvectorBackend) Delete(ctx context.Context, namespace, model, group, resource, name string, olderThanRV int64) error {
	req := &sqlEmbeddingsDeleteRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Model:       model,
		Group:       group,
		Resource:    resource,
		Name:        name,
		OlderThanRV: olderThanRV,
	}
	_, err := dbutil.Exec(ctx, b.db, sqlEmbeddingsDelete, req)
	return err
}

func (b *pgvectorBackend) Search(ctx context.Context, namespace, model, group, resource string,
	embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error) {
	req := &sqlEmbeddingsSearchRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Namespace:      namespace,
		Model:          model,
		Group:          group,
		Resource:       resource,
		QueryEmbedding: pgvector.NewHalfVector(embedding),
		Limit:          int64(limit),
		Response:       &sqlEmbeddingsSearchResponse{},
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

	rows, err := dbutil.Query(ctx, b.db, sqlEmbeddingsSearch, req)
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

func (b *pgvectorBackend) GetLatestRV(ctx context.Context, namespace, model string) (int64, error) {
	req := &sqlEmbeddingsGetLatestRVRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Model:       model,
		Response:    &sqlEmbeddingsGetLatestRVResponse{},
	}

	row, err := dbutil.QueryRow(ctx, b.db, sqlEmbeddingsGetLatestRV, req)
	if err != nil {
		return 0, err
	}
	return row.ResourceVersion, nil
}

// ensurePartition creates the nested (namespace, model) partitions if the
// leaf partition isn't already in the sync.Map cache. Both CREATE TABLE
// statements use IF NOT EXISTS, so running the namespace-level DDL redundantly
// across models is a cheap no-op at Postgres's level.
//
// The template is rendered directly and executed without going through
// dbutil.Exec's FormatSQL pass, because FormatSQL inserts spaces around
// operator characters like `-` even when they appear inside the string literal
// that names the partition value (e.g. 'stacks-123' would become
// 'stacks - 123'). Partition values in CREATE TABLE ... FOR VALUES IN (...)
// must be constant literals, so they can't be passed as bind parameters either.
func (b *pgvectorBackend) ensurePartition(ctx context.Context, tx db.Tx, key partitionKey) error {
	if _, ok := b.partitions.Load(key); ok {
		return nil
	}

	nsName, modelName := sanitizePartitionNames(key.namespace, key.model)
	req := &sqlEmbeddingsCreatePartitionRequest{
		SQLTemplate:            sqltemplate.New(b.dialect),
		Namespace:              key.namespace,
		Model:                  key.model,
		NamespacePartitionName: nsName,
		ModelPartitionName:     modelName,
	}
	if err := req.Validate(); err != nil {
		return err
	}
	query, err := sqltemplate.Execute(sqlEmbeddingsCreatePartition, req)
	if err != nil {
		return fmt.Errorf("render partition DDL: %w", err)
	}
	if _, err := tx.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("create partition: %w", err)
	}

	b.partitions.Store(key, struct{}{})
	return nil
}

// sanitizePartitionNames returns the (namespace-partition, model-partition)
// table names for a given (namespace, model) pair. Non-alphanumeric characters
// are replaced with underscores so the names are valid PostgreSQL identifiers.
func sanitizePartitionNames(namespace, model string) (nsName, modelName string) {
	ns := strings.ToLower(sanitizeRe.ReplaceAllString(namespace, "_"))
	m := strings.ToLower(sanitizeRe.ReplaceAllString(model, "_"))
	nsName = "resource_embeddings_" + ns
	modelName = nsName + "__" + m
	return nsName, modelName
}
