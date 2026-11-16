package search

import (
	"context"
	"time"
)

// queryBackend retrieves candidates and documents for an already-prepared query.
// The caller handles authorization and page filling.
type queryBackend interface {
	Search(context.Context, queryRequest) (*queryResult, error)
	// Missing documents must be omitted, not returned with empty metadata.
	ReadAuthzMetadata(context.Context, []string) (*queryMetadata, error)
	// Lookup reapplies the query so documents deleted or changed out of its scope
	// after authorization are not returned with newly loaded fields.
	Lookup(ctx context.Context, ids, fields []string, reverse bool) (*queryResult, error)
}

type queryRequest struct {
	Size int
	// Nil fields avoids loading values for candidates that may be unauthorized.
	Fields      []string
	SearchAfter []string
	// Reverse applies to every component of the prepared sort order.
	Reverse bool
}

type queryHit struct {
	// ID uses Grafana's namespace/group/resource/name identity, not an engine ID.
	ID     string
	Score  float64
	Fields map[string]any
	// Sort is the cursor returned to clients and used to fetch the next window.
	Sort []string
	// SortKey excludes the score, which can change when other documents change.
	// Its values are opaque and compared only within the prepared query.
	SortKey []string
}

type queryResult struct {
	Hits []*queryHit
	// Total must count every match, including candidates not authorized yet.
	Total    uint64
	MaxScore float64
	Took     time.Duration
	Cost     uint64
}

type queryMetadata struct {
	Values map[string]authzMetadata
	Took   time.Duration
	Cost   uint64
}
