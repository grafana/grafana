// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsSpec struct {
	DefaultFields []string `json:"defaultFields"`
}

// NewLogsSpec creates a new LogsSpec object.
func NewLogsSpec() *LogsSpec {
	return &LogsSpec{
		DefaultFields: []string{},
	}
}
