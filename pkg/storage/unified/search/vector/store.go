package vector

import (
	"context"
	"encoding/json"
)

// VectorBackend abstracts vector storage operations. The pgvector implementation
// is the only backend for now, but the interface allows testing with mocks.
type VectorBackend interface {
	// Search performs vector similarity search with optional metadata filtering.
	Search(ctx context.Context, namespace, group, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	// Upsert inserts or updates vectors. Vectors are grouped by namespace internally.
	Upsert(ctx context.Context, vectors []Vector) error

	// Delete removes vectors for a resource. If olderThanRV > 0, only deletes
	// vectors with resource_version < olderThanRV (stale panel cleanup after update).
	// If olderThanRV == 0, deletes all vectors for the resource (full delete).
	Delete(ctx context.Context, namespace, group, resource, name string, olderThanRV int64) error

	// GetLatestRV returns the maximum resource_version stored for a namespace.
	// Returns 0 if no vectors exist. Used by the write pipeline to resume polling.
	GetLatestRV(ctx context.Context, namespace string) (int64, error)
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
