// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DatasourceCheckSpec struct {
	// This can be customized per check
	Data map[string]string `json:"data,omitempty"`
}

// NewDatasourceCheckSpec creates a new DatasourceCheckSpec object.
func NewDatasourceCheckSpec() *DatasourceCheckSpec {
	return &DatasourceCheckSpec{}
}
