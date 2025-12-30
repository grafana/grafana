// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// DataSourceMapping specifies a datasource to validate dashboard queries against.
// Maps logical datasource references in the dashboard to actual datasource instances.
export interface DataSourceMapping {
	// Unique identifier of the datasource instance.
	// Example: "prometheus-prod-us-west"
	uid: string;
	// Type of datasource plugin.
	// MVP: Only "prometheus" supported.
	// Future: "mysql", "postgres", "elasticsearch", etc.
	type: string;
	// Optional human-readable name for display in results.
	// If not provided, UID will be used in error messages.
	// Example: "Production Prometheus (US-West)"
	name?: string;
}

export const defaultDataSourceMapping = (): DataSourceMapping => ({
	uid: "",
	type: "",
});

export interface Spec {
	// Complete dashboard JSON object to validate.
	// Must be a v1 dashboard schema (contains "panels" array).
	// v2 dashboards (with "elements" structure) are not yet supported.
	dashboardJson: Record<string, any>;
	// Array of datasources to validate against.
	// The validator will check dashboard queries against each datasource
	// and provide per-datasource compatibility results.
	// 
	// MVP: Only single datasource supported (array length = 1), Prometheus type only.
	// Future: Will support multiple datasources for dashboards with mixed queries.
	datasourceMappings: DataSourceMapping[];
}

export const defaultSpec = (): Spec => ({
	dashboardJson: {},
	datasourceMappings: [],
});

