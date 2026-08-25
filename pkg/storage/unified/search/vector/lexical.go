package vector

import (
	"context"
	"encoding/json"
)

// LexicalQuery is one lexical retrieval over an external collection's
// stored rows. There is no group field: the catalog resolves (group,
// resource) to the unique partition key before the leg runs, and
// embeddings rows are keyed by partition key — same contract as
// VectorBackend.Search.
type LexicalQuery struct {
	Namespace string
	// Model scopes matching to rows written by the current embedder model;
	// external rows are duplicated per model, so this is the dedup boundary.
	Model    string
	Resource string // partition key (Collection.PartitionKey)
	// Query is the caller's raw query string; each implementation
	// interprets it natively (postgres: websearch_to_tsquery). HybridSearch
	// promises no query syntax, so implementations may differ.
	Query string
	Limit int
	// Filters are backend-neutral key/values: "uid" is a first-class
	// column, any other key matches inside the metadata JSONB.
	Filters []SearchFilter
}

// LexicalHit is one per-uid result, carrying the best-matching chunk.
// Score is only meaningful for ordering within a single result set —
// RRF fusion consumes ranks, never magnitudes.
type LexicalHit struct {
	UID    string
	Title  string
	Folder string
	Score  float64

	// Best-matching chunk. Empty Content means the implementation stores
	// no chunk text; the hybrid layer then falls back to a synthesized
	// title chunk.
	Subresource string
	Content     string
	Metadata    json.RawMessage
}

// LexicalSearcher is the swap point for HybridSearch's lexical leg over
// external collections: postgres FTS today, a bleve index accepting
// external documents later. Results are per-uid, ordered best-first.
type LexicalSearcher interface {
	LexicalSearch(ctx context.Context, q LexicalQuery) ([]LexicalHit, error)
}
