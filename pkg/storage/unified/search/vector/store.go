package vector

import (
	"context"
	"encoding/json"
	"errors"
)

// VectorBackend abstracts vector storage operations. The pgvector implementation
// is the only backend for now, but the interface allows testing with mocks.
//
// Storage is isolated per (namespace, model, collectionID): each tuple gets
// its own standalone table with its own HNSW index. Different models produce
// embeddings in different vector spaces, so mixing them in one index would
// yield meaningless nearest-neighbor results. Different collections (resource
// types) are also kept in separate indexes to avoid cross-type recall
// degradation.
type VectorBackend interface {
	// Search performs vector similarity search within a single
	// (namespace, model, collectionID) collection. The query embedding must
	// come from the same model as the stored vectors for results to be
	// meaningful.
	Search(ctx context.Context, namespace, model, collectionID string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	// Upsert inserts or updates vectors. Vectors are grouped by
	// (namespace, model, collectionID) internally so each combination lands
	// in its own collection table. Collection tables are created lazily on
	// first write.
	Upsert(ctx context.Context, vectors []Vector) error

	// Delete removes every row for a resource within a specific collection —
	// i.e. wipes all subresources under `name`. Used when a resource is
	// hard-deleted. model must be non-empty.
	Delete(ctx context.Context, namespace, model, collectionID, name string) error

	// DeleteSubresources removes specific subresources under `name` in a
	// collection. Callers use this for stale-subresource cleanup after diffing
	// GetSubresourceContent against the desired set. model must be non-empty.
	// An empty subresources slice is a no-op (no rows removed).
	DeleteSubresources(ctx context.Context, namespace, model, collectionID, name string, subresources []string) error

	// GetSubresourceContent returns the currently-stored content for each
	// subresource under (namespace, model, collectionID, name), keyed by
	// subresource. Missing or empty collections return a nil map with no
	// error. Callers compare against candidate content to decide which
	// subresources actually need re-embedding.
	GetSubresourceContent(ctx context.Context, namespace, model, collectionID, name string) (map[string]string, error)

	// GetLatestRV returns the maximum resource_version seen by any Upsert
	// across the entire backend. Returns 0 if no vectors have been written.
	// Used by the write pipeline to resume polling from a global checkpoint.
	GetLatestRV(ctx context.Context) (int64, error)

	// Run starts any background maintenance the backend needs (currently the
	// partition promoter) and blocks until ctx is cancelled. Callers should
	// gate this on ownership of the vector schema — non-owning targets can
	// either skip calling Run or rely on interval=0 to no-op.
	Run(ctx context.Context) error
}

// Vector represents a single embeddable subresource (e.g. one dashboard panel).
type Vector struct {
	Namespace       string
	CollectionID    string          // "<group>/<resource>", e.g. "dashboard.grafana.app/dashboards"
	Name            string          // resource name (e.g. dashboard UID)
	Subresource     string          // unique subresource ID, e.g. "panel/5"
	ResourceVersion int64           // RV at time of embedding; fed into the global checkpoint (not stored per-row). Will be deprecated.
	Folder          string          // folder UID for authz filtering
	Content         string          // text that was embedded
	Metadata        json.RawMessage // structured fields for filtering (JSONB)
	Embedding       []float32       // vector embedding
	Model           string          // embedding model name, e.g. "text-embedding-005"
}

func (v *Vector) Validate() error {
	switch {
	case v.Namespace == "":
		return errors.New("namespace must not be empty")
	case v.Model == "":
		return errors.New("model must not be empty")
	case v.CollectionID == "":
		return errors.New("collectionID must not be empty")
	case v.Name == "":
		return errors.New("name must not be empty")
	}
	return nil
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
