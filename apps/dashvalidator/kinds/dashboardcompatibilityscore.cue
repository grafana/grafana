package kinds

// DashboardCompatibilityScore validates whether a dashboard's queries
// are compatible with the target datasource schema.
//
// This resource checks if metrics, tables, or other identifiers referenced
// in dashboard queries actually exist in the configured datasources,
// helping users identify dashboards that will show "no data" before deployment.
//
// MVP: Prometheus datasource only; architecture supports future datasource types.
dashboardcompatibilityscorev0alpha1: {
	kind:   "DashboardCompatibilityScore"
	plural: "dashboardcompatibilityscores"
	scope:  "Namespaced"
	schema: {
		spec: {
			// Complete dashboard JSON object to validate.
			// Must be a v1 dashboard schema (contains "panels" array).
			// v2 dashboards (with "elements" structure) are not yet supported.
			dashboardJson: {...}

			// Array of datasources to validate against.
			// The validator will check dashboard queries against each datasource
			// and provide per-datasource compatibility results.
			//
			// MVP: Only single datasource supported (array length = 1), Prometheus type only.
			// Future: Will support multiple datasources for dashboards with mixed queries.
			datasourceMappings: [...#DataSourceMapping]
		}
		status: {
			// Overall compatibility score across all datasources (0-100).
			// Calculated as: (total found metrics / total referenced metrics) * 100
			//
			// Score interpretation:
			// - 100: Perfect compatibility, all queries will work
			// - 80-99: Excellent, minor missing metrics
			// - 50-79: Fair, significant missing metrics
			// - 0-49: Poor, most queries will fail
			compatibilityScore: float64

			// Per-datasource validation results.
			// Array length matches spec.datasourceMappings.
			// Each element contains detailed metrics and query-level breakdown.
			datasourceResults: [...#DataSourceResult]

			// ISO 8601 timestamp of when validation was last performed.
			// Example: "2024-01-15T10:30:00Z"
			lastChecked?: string

			// Human-readable summary of validation result.
			// Examples: "All queries compatible", "3 missing metrics found"
			message?: string
		}
	}
}

// DataSourceMapping specifies a datasource to validate dashboard queries against.
// Maps logical datasource references in the dashboard to actual datasource instances.
#DataSourceMapping: {
	// Unique identifier of the datasource instance.
	// Example: "prometheus-prod-us-west"
	uid: string

	// Type of datasource plugin.
	// MVP: Only "prometheus" supported.
	// Future: "mysql", "postgres", "elasticsearch", etc.
	type: string

	// Optional human-readable name for display in results.
	// If not provided, UID will be used in error messages.
	// Example: "Production Prometheus (US-West)"
	name?: string
}

// DataSourceResult contains validation results for a single datasource.
// Provides aggregate statistics and per-query breakdown of compatibility.
#DataSourceResult: {
	// Datasource UID that was validated (matches DataSourceMapping.uid)
	uid: string

	// Datasource type (matches DataSourceMapping.type)
	type: string

	// Optional display name (matches DataSourceMapping.name if provided)
	name?: string

	// Total number of queries in the dashboard targeting this datasource.
	// Includes all panel targets/queries that reference this datasource.
	totalQueries: int

	// Number of queries successfully validated.
	// May be less than totalQueries if some queries couldn't be parsed.
	checkedQueries: int

	// Total number of unique metrics/identifiers referenced across all queries.
	// For Prometheus: metric names extracted from PromQL expressions.
	// For SQL datasources: table and column names.
	totalMetrics: int

	// Number of metrics that exist in the datasource schema.
	// foundMetrics <= totalMetrics
	foundMetrics: int

	// Array of metric names that were referenced but don't exist.
	// Useful for debugging why a dashboard shows "no data".
	// Example for Prometheus: ["http_requests_total", "api_latency_seconds"]
	missingMetrics: [...string]

	// Per-query breakdown showing which specific queries have issues.
	// One entry per query target (refId: "A", "B", "C", etc.) in each panel.
	// Allows pinpointing exactly which panel/query needs fixing.
	queryBreakdown: [...#QueryBreakdown]

	// Overall compatibility score for this datasource (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// Used to calculate the global compatibilityScore in status.
	compatibilityScore: float64
}

// QueryBreakdown provides compatibility details for a single query within a panel.
// Granular per-query results allow users to identify exactly which queries need fixing.
//
// Note: A panel can have multiple queries (refId: "A", "B", "C", etc.),
// so there may be multiple QueryBreakdown entries for the same panelID.
#QueryBreakdown: {
	// Human-readable panel title for context.
	// Example: "CPU Usage", "Request Rate"
	panelTitle: string

	// Numeric panel ID from dashboard JSON.
	// Used to correlate with dashboard structure.
	panelID: int

	// Query identifier within the panel.
	// Values: "A", "B", "C", etc. (from panel.targets[].refId)
	// Uniquely identifies which query in a multi-query panel this refers to.
	queryRefId: string

	// Number of unique metrics referenced in this specific query.
	// For Prometheus: metrics extracted from the PromQL expr.
	// Example: rate(http_requests_total[5m]) references 1 metric.
	totalMetrics: int

	// Number of those metrics that exist in the datasource.
	// foundMetrics <= totalMetrics
	foundMetrics: int

	// Array of missing metric names specific to this query.
	// Helps identify exactly which part of a query expression will fail.
	// Empty array means query is fully compatible.
	missingMetrics: [...string]

	// Compatibility percentage for this individual query (0-100).
	// Calculated as: (foundMetrics / totalMetrics) * 100
	// 100 = query will work perfectly, 0 = query will return no data.
	compatibilityScore: float64

	// Optional error message for queries that failed to parse.
	// When present, the query is treated as 0% compatible.
	parseError?: string
}
