// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// DataSourceResult contains validation results for a single datasource.
// Provides aggregate statistics and per-query breakdown of compatibility.
// +k8s:openapi-gen=true
type DataSourceResult struct {
	// Datasource UID that was validated (matches DataSourceMapping.uid)
	Uid string `json:"uid"`
	// Datasource type (matches DataSourceMapping.type)
	Type string `json:"type"`
	// Optional display name (matches DataSourceMapping.name if provided)
	Name *string `json:"name,omitempty"`
	// Total number of queries in the dashboard targeting this datasource.
	// Includes all panel targets/queries that reference this datasource.
	TotalQueries int64 `json:"totalQueries"`
	// Number of queries successfully validated.
	// May be less than totalQueries if some queries couldn't be parsed.
	CheckedQueries int64 `json:"checkedQueries"`
	// Total number of unique metrics/identifiers referenced across all queries.
	// For Prometheus: metric names extracted from PromQL expressions.
	// For SQL datasources: table and column names.
	TotalMetrics int64 `json:"totalMetrics"`
	// Number of metrics that exist in the datasource schema.
	// foundMetrics <= totalMetrics
	FoundMetrics int64 `json:"foundMetrics"`
	// Array of metric names that were referenced but don't exist.
	// Useful for debugging why a dashboard shows "no data".
	// Example for Prometheus: ["http_requests_total", "api_latency_seconds"]
	MissingMetrics []string `json:"missingMetrics"`
	// Per-query breakdown showing which specific queries have issues.
	// One entry per query target (refId: "A", "B", "C", etc.) in each panel.
	// Allows pinpointing exactly which panel/query needs fixing.
	QueryBreakdown []QueryBreakdown `json:"queryBreakdown"`
	// Overall compatibility score for this datasource (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// Used to calculate the global compatibilityScore in status.
	CompatibilityScore float64 `json:"compatibilityScore"`
}

// NewDataSourceResult creates a new DataSourceResult object.
func NewDataSourceResult() *DataSourceResult {
	return &DataSourceResult{
		MissingMetrics: []string{},
		QueryBreakdown: []QueryBreakdown{},
	}
}

// QueryBreakdown provides compatibility details for a single query within a panel.
// Granular per-query results allow users to identify exactly which queries need fixing.
//
// Note: A panel can have multiple queries (refId: "A", "B", "C", etc.),
// so there may be multiple QueryBreakdown entries for the same panelID.
// +k8s:openapi-gen=true
type QueryBreakdown struct {
	// Human-readable panel title for context.
	// Example: "CPU Usage", "Request Rate"
	PanelTitle string `json:"panelTitle"`
	// Numeric panel ID from dashboard JSON.
	// Used to correlate with dashboard structure.
	PanelID int64 `json:"panelID"`
	// Query identifier within the panel.
	// Values: "A", "B", "C", etc. (from panel.targets[].refId)
	// Uniquely identifies which query in a multi-query panel this refers to.
	QueryRefId string `json:"queryRefId"`
	// Number of unique metrics referenced in this specific query.
	// For Prometheus: metrics extracted from the PromQL expr.
	// Example: rate(http_requests_total[5m]) references 1 metric.
	TotalMetrics int64 `json:"totalMetrics"`
	// Number of those metrics that exist in the datasource.
	// foundMetrics <= totalMetrics
	FoundMetrics int64 `json:"foundMetrics"`
	// Array of missing metric names specific to this query.
	// Helps identify exactly which part of a query expression will fail.
	// Empty array means query is fully compatible.
	MissingMetrics []string `json:"missingMetrics"`
	// Compatibility percentage for this individual query (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// 100 = query will work perfectly, 0 = query will return no data.
	CompatibilityScore float64 `json:"compatibilityScore"`
}

// NewQueryBreakdown creates a new QueryBreakdown object.
func NewQueryBreakdown() *QueryBreakdown {
	return &QueryBreakdown{
		MissingMetrics: []string{},
	}
}

// +k8s:openapi-gen=true
type StatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State StatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewStatusOperatorState creates a new StatusOperatorState object.
func NewStatusOperatorState() *StatusOperatorState {
	return &StatusOperatorState{}
}

// +k8s:openapi-gen=true
type Status struct {
	// Overall compatibility score across all datasources (0-100).
	// Calculated as: (total found metrics / total referenced metrics) * 100
	//
	// Score interpretation:
	// - 100: Perfect compatibility, all queries will work
	// - 80-99: Excellent, minor missing metrics
	// - 50-79: Fair, significant missing metrics
	// - 0-49: Poor, most queries will fail
	CompatibilityScore float64 `json:"compatibilityScore"`
	// Per-datasource validation results.
	// Array length matches spec.datasourceMappings.
	// Each element contains detailed metrics and query-level breakdown.
	DatasourceResults []DataSourceResult `json:"datasourceResults"`
	// ISO 8601 timestamp of when validation was last performed.
	// Example: "2024-01-15T10:30:00Z"
	LastChecked *string `json:"lastChecked,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]StatusOperatorState `json:"operatorStates,omitempty"`
	// Human-readable summary of validation result.
	// Examples: "All queries compatible", "3 missing metrics found"
	Message *string `json:"message,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewStatus creates a new Status object.
func NewStatus() *Status {
	return &Status{
		DatasourceResults: []DataSourceResult{},
	}
}

// +k8s:openapi-gen=true
type StatusOperatorStateState string

const (
	StatusOperatorStateStateSuccess    StatusOperatorStateState = "success"
	StatusOperatorStateStateInProgress StatusOperatorStateState = "in_progress"
	StatusOperatorStateStateFailed     StatusOperatorStateState = "failed"
)
