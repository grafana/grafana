// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QueryHistorySpec struct {
	// Primary datasource UID
	DatasourceUid string `json:"datasourceUid"`
	// Opaque JSON blob of DataQuery objects
	Queries interface{} `json:"queries"`
	// User-editable comment
	Comment *string `json:"comment,omitempty"`
}

// NewQueryHistorySpec creates a new QueryHistorySpec object.
func NewQueryHistorySpec() *QueryHistorySpec {
	return &QueryHistorySpec{}
}

// OpenAPIModelName returns the OpenAPI model name for QueryHistorySpec.
func (QueryHistorySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.queryhistory.pkg.apis.queryhistory.v0alpha1.QueryHistorySpec"
}
