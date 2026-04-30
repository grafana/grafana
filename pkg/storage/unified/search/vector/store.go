package vector

import (
	"context"
	"encoding/json"
	"errors"
)

// VectorBackend is vector storage isolated per (namespace, model) so an HNSW
// never mixes embeddings from different vector spaces.
type VectorBackend interface {
	// Search returns top-N nearest neighbors by cosine distance. Query
	// embedding must come from the same model as stored vectors.
	Search(ctx context.Context, namespace, model, resource string,
		embedding []float32, limit int, filters ...SearchFilter) ([]VectorSearchResult, error)

	Upsert(ctx context.Context, vectors []Vector) error

	// Delete removes every resource and subresource under `uid`. model must be non-empty.
	Delete(ctx context.Context, namespace, model, resource, uid string) error

	// DeleteSubresources removes specific subresources under `uid`. Empty
	// slice is a no-op. model must be non-empty.
	DeleteSubresources(ctx context.Context, namespace, model, resource, uid string, subresources []string) error

	// GetSubresourceContent returns subresource → stored content. Callers
	// diff against candidate content to skip re-embedding unchanged rows.
	// Used for deleting stale subresource embeddings.
	GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, error)

	// GetLatestRV is the global write-pipeline checkpoint. 0 if empty.
	GetLatestRV(ctx context.Context) (int64, error)

	// Run starts background maintenance (promoter). Gate on schema ownership.
	Run(ctx context.Context) error
}

// Vector is one embeddable subresource (e.g. a dashboard panel).
type Vector struct {
	Namespace       string
	Resource        string // e.g. "dashboards"
	UID             string // stable resource identifier (e.g. dashboard UID)
	Title           string // human-readable title for search results
	Subresource     string // e.g. "panel/5"
	ResourceVersion int64  // feeds the global checkpoint; not stored per-row
	Folder          string // folder UID for authz filtering
	Content         string // text that was embedded
	Metadata        json.RawMessage
	Embedding       []float32
	Model           string
}

func (v *Vector) Validate() error {
	switch {
	case v.Namespace == "":
		return errors.New("namespace must not be empty")
	case v.Model == "":
		return errors.New("model must not be empty")
	case v.Resource == "":
		return errors.New("resource must not be empty")
	case v.UID == "":
		return errors.New("uid must not be empty")
	case v.Title == "":
		return errors.New("title must not be empty")
	}
	return nil
}

type VectorSearchResult struct {
	UID         string
	Title       string
	Subresource string
	Content     string
	Score       float64
	Folder      string
	Metadata    json.RawMessage
}

// SearchFilter constrains results. Field is a top-level column
// ("uid", "folder") or a JSONB metadata key.
type SearchFilter struct {
	Field  string
	Values []string
}
