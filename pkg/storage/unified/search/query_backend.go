package search

import (
	"context"
	"time"
)

// queryBackend retrieves candidates and documents for an already-prepared query.
// The caller handles authorization and page filling.
//
// Search order must be deterministic and include a unique tie-breaker. Later
// calls must not modify returned hits or their maps and slices: the caller
// retains hits and may replace their Fields during revalidation.
type queryBackend interface {
	Search(context.Context, queryRequest) (queryResult, error)
	// Missing documents must be omitted, not returned with empty metadata.
	ReadAuthzMetadata(context.Context, []string) (queryMetadata, error)
	// Lookup reapplies the query so documents deleted or changed out of its scope
	// after authorization are not returned with newly loaded fields.
	Lookup(context.Context, queryLookupRequest) (queryResult, error)
}

type queryRequest struct {
	Size int
	// Nil fields avoids loading values for candidates that may be unauthorized.
	Fields      []string
	SearchAfter queryCursor
	// Reverse applies to every component of the prepared sort order.
	Reverse bool
}

type queryLookupRequest struct {
	IDs     []string
	Fields  []string
	Reverse bool
}

type queryCursor []string

type queryStableSortKey []string

type queryHit struct {
	// ID uses Grafana's namespace/group/resource/name identity, not an engine ID.
	ID    string
	Score float64
	// Fields uses stored names; app fields may use the "fields." prefix.
	// Scalars are string, bool, or float64; integer/date fields also accept int64.
	// Dates use Unix milliseconds. Arrays use typed slices or []any.
	// Missing entries and nil values mean missing; preserve zeros and empty slices.
	// Resource versions use SEARCH_FIELD_RV_STRING and legacy IDs use
	// "labels."+SEARCH_FIELD_LEGACY_ID; both are decimal strings.
	Fields map[string]any
	// Cursor is returned to clients and used to fetch the next window.
	Cursor queryCursor
	// StableSortKey excludes the score, which can change when other documents change.
	// Its values are opaque and compared only within the prepared query.
	StableSortKey queryStableSortKey
}

type queryResult struct {
	Hits []*queryHit
	// Total counts every query match before cursor and size limits, including
	// candidates not authorized yet.
	Total    uint64
	MaxScore float64
	Took     time.Duration
	// Cost is backend-reported index bytes read; zero if unavailable.
	Cost uint64
}

type queryMetadata struct {
	Values map[string]authzMetadata
	Took   time.Duration
	// Cost uses the same byte units as queryResult.Cost.
	Cost uint64
}
