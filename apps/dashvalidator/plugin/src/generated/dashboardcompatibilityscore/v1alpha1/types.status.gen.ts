// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// DataSourceResult contains validation results for a single datasource.
// Provides aggregate statistics and per-query breakdown of compatibility.
export interface DataSourceResult {
	// Datasource UID that was validated (matches DataSourceMapping.uid)
	uid: string;
	// Datasource type (matches DataSourceMapping.type)
	type: string;
	// Optional display name (matches DataSourceMapping.name if provided)
	name?: string;
	// Total number of queries in the dashboard targeting this datasource.
	// Includes all panel targets/queries that reference this datasource.
	totalQueries: number;
	// Number of queries successfully validated.
	// May be less than totalQueries if some queries couldn't be parsed.
	checkedQueries: number;
	// Total number of unique metrics/identifiers referenced across all queries.
	// For Prometheus: metric names extracted from PromQL expressions.
	// For SQL datasources: table and column names.
	totalMetrics: number;
	// Number of metrics that exist in the datasource schema.
	// foundMetrics <= totalMetrics
	foundMetrics: number;
	// Array of metric names that were referenced but don't exist.
	// Useful for debugging why a dashboard shows "no data".
	// Example for Prometheus: ["http_requests_total", "api_latency_seconds"]
	missingMetrics: string[];
	// Per-query breakdown showing which specific queries have issues.
	// One entry per query target (refId: "A", "B", "C", etc.) in each panel.
	// Allows pinpointing exactly which panel/query needs fixing.
	queryBreakdown: QueryBreakdown[];
	// Overall compatibility score for this datasource (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// Used to calculate the global compatibilityScore in status.
	compatibilityScore: number;
}

export const defaultDataSourceResult = (): DataSourceResult => ({
	uid: "",
	type: "",
	totalQueries: 0,
	checkedQueries: 0,
	totalMetrics: 0,
	foundMetrics: 0,
	missingMetrics: [],
	queryBreakdown: [],
	compatibilityScore: 0,
});

// QueryBreakdown provides compatibility details for a single query within a panel.
// Granular per-query results allow users to identify exactly which queries need fixing.
// 
// Note: A panel can have multiple queries (refId: "A", "B", "C", etc.),
// so there may be multiple QueryBreakdown entries for the same panelID.
export interface QueryBreakdown {
	// Human-readable panel title for context.
	// Example: "CPU Usage", "Request Rate"
	panelTitle: string;
	// Numeric panel ID from dashboard JSON.
	// Used to correlate with dashboard structure.
	panelID: number;
	// Query identifier within the panel.
	// Values: "A", "B", "C", etc. (from panel.targets[].refId)
	// Uniquely identifies which query in a multi-query panel this refers to.
	queryRefId: string;
	// Number of unique metrics referenced in this specific query.
	// For Prometheus: metrics extracted from the PromQL expr.
	// Example: rate(http_requests_total[5m]) references 1 metric.
	totalMetrics: number;
	// Number of those metrics that exist in the datasource.
	// foundMetrics <= totalMetrics
	foundMetrics: number;
	// Array of missing metric names specific to this query.
	// Helps identify exactly which part of a query expression will fail.
	// Empty array means query is fully compatible.
	missingMetrics: string[];
	// Compatibility percentage for this individual query (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// 100 = query will work perfectly, 0 = query will return no data.
	compatibilityScore: number;
	// Optional error message for queries that failed to parse.
	// When present, the query is treated as 0% compatible.
	parseError?: string;
}

export const defaultQueryBreakdown = (): QueryBreakdown => ({
	panelTitle: "",
	panelID: 0,
	queryRefId: "",
	totalMetrics: 0,
	foundMetrics: 0,
	missingMetrics: [],
	compatibilityScore: 0,
});

export interface OperatorState {
	// lastEvaluation is the ResourceVersion last evaluated
	lastEvaluation: string;
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	state: "success" | "in_progress" | "failed";
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	descriptiveState?: string;
	// details contains any extra information that is operator-specific
	details?: Record<string, any>;
}

export const defaultOperatorState = (): OperatorState => ({
	lastEvaluation: "",
	state: "success",
});

export interface Status {
	// Overall compatibility score across all datasources (0-100).
	// Calculated as: (total found metrics / total referenced metrics) * 100
	// 
	// Score interpretation:
	// - 100: Perfect compatibility, all queries will work
	// - 80-99: Excellent, minor missing metrics
	// - 50-79: Fair, significant missing metrics
	// - 0-49: Poor, most queries will fail
	compatibilityScore: number;
	// Per-datasource validation results.
	// Array length matches spec.datasourceMappings.
	// Each element contains detailed metrics and query-level breakdown.
	datasourceResults: DataSourceResult[];
	// ISO 8601 timestamp of when validation was last performed.
	// Example: "2024-01-15T10:30:00Z"
	lastChecked?: string;
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	operatorStates?: Record<string, OperatorState>;
	// Human-readable summary of validation result.
	// Examples: "All queries compatible", "3 missing metrics found"
	message?: string;
	// additionalFields is reserved for future use
	additionalFields?: Record<string, any>;
}

export const defaultStatus = (): Status => ({
	compatibilityScore: 0,
	datasourceResults: [],
});

