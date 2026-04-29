package validator

import (
	"context"
	"net/http"
)

// DatasourceValidator validates dashboard queries against a datasource.
// Implementations exist per datasource type (Prometheus, MySQL, etc.).
type DatasourceValidator interface {
	// ValidateQueries checks if queries are compatible with the datasource
	ValidateQueries(ctx context.Context, queries []Query, datasource Datasource) (*ValidationResult, error)
}

// MetricExtractor parses datasource-specific queries and extracts metric/entity names.
// Implementations exist per datasource type (Prometheus, MySQL, Loki, etc.).
type MetricExtractor interface {
	// ExtractMetrics parses a query and returns the list of metrics/entities referenced.
	// Returns an error if the query syntax is invalid.
	ExtractMetrics(queryText string) ([]string, error)
}

// MetricsFetcher fetches available metrics/entities from a datasource.
type MetricsFetcher interface {
	// FetchMetrics queries the datasource to get all available metric/entity names.
	// The provided HTTP client should have proper authentication configured.
	FetchMetrics(ctx context.Context, datasourceURL string, client *http.Client) ([]string, error)
}

// Query represents a dashboard query to validate
type Query struct {
	RefID      string // Query reference ID (A, B, C, etc.)
	QueryText  string // The actual query text (PromQL, SQL, etc.)
	PanelTitle string // Panel title for user-friendly reporting
	PanelID    int    // Panel ID for reference
}

// Datasource contains connection information for a datasource
type Datasource struct {
	UID        string       // Datasource UID from dashboard
	Type       string       // Datasource type (prometheus, mysql, etc.)
	Name       string       // Datasource name for reporting
	URL        string       // Datasource URL for API calls
	HTTPClient *http.Client // Authenticated HTTP client for making requests
}

// CompatibilityResult contains the shared metrics compatibility fields
// used by both ValidationResult (aggregate) and QueryResult (per-query).
type CompatibilityResult struct {
	TotalMetrics       int      `json:"totalMetrics"`
	FoundMetrics       int      `json:"foundMetrics"`
	MissingMetrics     []string `json:"missingMetrics"`
	CompatibilityScore float64  `json:"compatibilityScore"`
}

// ValidationResult contains validation results for a datasource
type ValidationResult struct {
	TotalQueries   int           `json:"totalQueries"`   // Total number of queries found
	CheckedQueries int           `json:"checkedQueries"` // Number of queries successfully checked
	QueryBreakdown []QueryResult `json:"queryBreakdown"` // Per-query results
	CompatibilityResult
}

// QueryResult contains validation results for a single query
type QueryResult struct {
	PanelTitle string `json:"panelTitle"` // Panel title
	PanelID    int    `json:"panelID"`    // Panel ID
	QueryRefID string `json:"queryRefId"` // Query reference ID
	CompatibilityResult
	ParseError *string `json:"parseError,omitempty"` // Optional parse error message (nil = parsed successfully)
}
