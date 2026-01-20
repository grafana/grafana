package validator

import (
	"context"
	"fmt"
	"net/http"
)

// DatasourceValidator validates dashboard queries against a datasource
// Implementations exist per datasource type (Prometheus, MySQL, etc.)
type DatasourceValidator interface {
	// ValidateQueries checks if queries are compatible with the datasource
	ValidateQueries(ctx context.Context, queries []Query, datasource Datasource) (*ValidationResult, error)
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

// ValidationResult contains validation results for a datasource
type ValidationResult struct {
	TotalQueries       int           // Total number of queries found
	CheckedQueries     int           // Number of queries successfully checked
	TotalMetrics       int           // Total metrics/entities referenced
	FoundMetrics       int           // Metrics found in datasource
	MissingMetrics     []string      // List of missing metrics
	QueryBreakdown     []QueryResult // Per-query results
	CompatibilityScore float64       // Overall compatibility (0.0 - 1.0)
}

// QueryResult contains validation results for a single query
type QueryResult struct {
	PanelTitle         string   // Panel title
	PanelID            int      // Panel ID
	QueryRefID         string   // Query reference ID
	TotalMetrics       int      // Metrics in this query
	FoundMetrics       int      // Metrics found
	MissingMetrics     []string // Missing metrics for this query
	CompatibilityScore float64  // Query compatibility (0.0 - 1.0)
	ParseError         *string  // Optional parse error message (nil = parsed successfully)
}

// validatorRegistry holds registered validator constructors
// Validators register themselves using RegisterValidator in their init() functions
var validatorRegistry = make(map[string]func() DatasourceValidator)

// RegisterValidator registers a validator constructor for a datasource type
// This is called by validator implementations in their init() functions
// Example: validator.RegisterValidator("prometheus", func() validator.DatasourceValidator { return NewValidator() })
func RegisterValidator(dsType string, constructor func() DatasourceValidator) {
	validatorRegistry[dsType] = constructor
}

// GetValidator returns a validator for the given datasource type
// Returns an error if the datasource type is not supported
func GetValidator(dsType string) (DatasourceValidator, error) {
	constructor, ok := validatorRegistry[dsType]
	if !ok {
		return nil, fmt.Errorf("unsupported datasource type: %s", dsType)
	}
	return constructor(), nil
}
