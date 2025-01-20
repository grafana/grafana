// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DatasourceCheckSpec struct {
	// Generic data input that a check can receive
	Data map[string]string `json:"data,omitempty"`
}

// NewDatasourceCheckSpec creates a new DatasourceCheckSpec object.
func NewDatasourceCheckSpec() *DatasourceCheckSpec {
	return &DatasourceCheckSpec{}
}
