// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// DataSourceMapping specifies a datasource to validate dashboard queries against.
// Maps logical datasource references in the dashboard to actual datasource instances.
// +k8s:openapi-gen=true
type DashboardCompatibilityScoreDataSourceMapping struct {
	// Unique identifier of the datasource instance.
	// Example: "prometheus-prod-us-west"
	Uid string `json:"uid"`
	// Type of datasource plugin.
	// MVP: Only "prometheus" supported.
	// Future: "mysql", "postgres", "elasticsearch", etc.
	Type string `json:"type"`
	// Optional human-readable name for display in results.
	// If not provided, UID will be used in error messages.
	// Example: "Production Prometheus (US-West)"
	Name *string `json:"name,omitempty"`
}

// NewDashboardCompatibilityScoreDataSourceMapping creates a new DashboardCompatibilityScoreDataSourceMapping object.
func NewDashboardCompatibilityScoreDataSourceMapping() *DashboardCompatibilityScoreDataSourceMapping {
	return &DashboardCompatibilityScoreDataSourceMapping{}
}

// +k8s:openapi-gen=true
type DashboardCompatibilityScoreSpec struct {
	// Complete dashboard JSON object to validate.
	// Must be a v1 dashboard schema (contains "panels" array).
	// v2 dashboards (with "elements" structure) are not yet supported.
	DashboardJson map[string]interface{} `json:"dashboardJson"`
	// Array of datasources to validate against.
	// The validator will check dashboard queries against each datasource
	// and provide per-datasource compatibility results.
	//
	// MVP: Only single datasource supported (array length = 1), Prometheus type only.
	// Future: Will support multiple datasources for dashboards with mixed queries.
	DatasourceMappings []DashboardCompatibilityScoreDataSourceMapping `json:"datasourceMappings"`
}

// NewDashboardCompatibilityScoreSpec creates a new DashboardCompatibilityScoreSpec object.
func NewDashboardCompatibilityScoreSpec() *DashboardCompatibilityScoreSpec {
	return &DashboardCompatibilityScoreSpec{
		DashboardJson:      map[string]interface{}{},
		DatasourceMappings: []DashboardCompatibilityScoreDataSourceMapping{},
	}
}
