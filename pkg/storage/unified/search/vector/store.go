package vector

import (
	"context"
	"encoding/json"
)

// VectorBackend abstracts vector storage operations. The pgvector implementation
// is the only backend for now, but the interface allows testing with mocks.
//
// Storage is partitioned by (namespace, model): each (tenant, embedding model)
// pair gets its own HNSW index. Different models produce embeddings in
// different vector spaces, so mixing them in one index would yield meaningless
// nearest-neighbor results.
type VectorBackend interface {
	// Search performs vector similarity search within a single (namespace, model)
	// partition. The query embedding must come from the same model as the
	// stored vectors for results to be meaningful.
	Search(ctx context.Context, namespace, model, group, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	// Upsert inserts or updates vectors. Vectors are grouped by (namespace, model)
	// internally so that each combination lands in its own partition.
	Upsert(ctx context.Context, vectors []Vector) error

	// Delete removes vectors for a resource. If model is non-empty, only rows
	// in that model's partition are deleted; an empty model deletes across all
	// models (used when a resource is removed from storage entirely).
	// If olderThanRV > 0, only vectors with resource_version < olderThanRV are
	// removed (stale panel cleanup after update); olderThanRV == 0 deletes all.
	Delete(ctx context.Context, namespace, model, group, resource, name string, olderThanRV int64) error

	// GetLatestRV returns the maximum resource_version stored for a given
	// (namespace, model). Returns 0 if no vectors exist. Used by the write
	// pipeline to resume polling per model.
	GetLatestRV(ctx context.Context, namespace, model string) (int64, error)
}

// Vector represents a single embeddable subresource (e.g. one dashboard panel).
type Vector struct {
	Namespace       string
	Group           string          // API group, e.g. "dashboard.grafana.app"
	Resource        string          // resource type, e.g. "dashboards"
	Name            string          // resource name (e.g. dashboard UID)
	Subresource     string          // unique subresource ID, e.g. "panel/5"
	ResourceVersion int64           // RV at time of embedding
	Folder          string          // folder UID for authz filtering
	Content         string          // text that was embedded
	Metadata        json.RawMessage // structured fields for filtering (JSONB)
	Embedding       []float32       // vector embedding
	Model           string          // embedding model name, e.g. "text-embedding-005"
}

// VectorSearchResult is a single result from a vector similarity search.
type VectorSearchResult struct {
	Name        string
	Subresource string
	Content     string
	Score       float64
	Folder      string
	Metadata    json.RawMessage
}

// SearchFilter constrains vector search results.
// Field is either a top-level column ("name", "folder") or a JSONB metadata
// key ("datasource_uids", "query_languages").
type SearchFilter struct {
	Field  string
	Values []string
}
