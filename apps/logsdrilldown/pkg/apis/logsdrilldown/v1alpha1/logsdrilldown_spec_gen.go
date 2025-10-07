// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownSpec struct {
	DefaultFields []string `json:"defaultFields"`
}

// NewLogsDrilldownSpec creates a new LogsDrilldownSpec object.
func NewLogsDrilldownSpec() *LogsDrilldownSpec {
	return &LogsDrilldownSpec{
		DefaultFields: []string{},
	}
}
