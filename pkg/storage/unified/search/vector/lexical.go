package vector

import (
	"context"
	"encoding/json"
)

// LexicalQuery is one lexical retrieval over an external collection.
// No group field: callers resolve (group, resource) to the unique
// partition key first, same contract as VectorBackend.Search.
type LexicalQuery struct {
	Namespace string
	// Model scopes to the current embedder's rows — the model-dedup boundary.
	Model    string
	Resource string // partition key (Collection.PartitionKey)
	// Raw query string; interpretation is implementation-defined
	// (postgres: websearch syntax).
	Query string
	Limit int
	// "uid" and "folder" are columns; any other key matches the metadata JSONB.
	Filters []SearchFilter
}

// LexicalHit is one per-uid result with its best-matching chunk.
// Score orders results within one set; RRF consumes ranks, not magnitudes.
type LexicalHit struct {
	UID    string
	Title  string
	Folder string
	Score  float64

	// Best chunk; empty Content → hybrid falls back to a synthesized title chunk.
	Subresource string
	Content     string
	Metadata    json.RawMessage
}

// LexicalSearcher is the swap point for HybridSearch's external lexical
// leg: postgres FTS today, bleve-with-external-docs later. Results are
// per-uid, best-first.
type LexicalSearcher interface {
	LexicalSearch(ctx context.Context, q LexicalQuery) ([]LexicalHit, error)
}
