// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsSpec struct {
	DefaultFields      []string `json:"defaultFields"`
	PrettifyJSON       bool     `json:"prettifyJSON"`
	WrapLogMessage     bool     `json:"wrapLogMessage"`
	InterceptDismissed bool     `json:"interceptDismissed"`
}

// NewLogsDrilldownDefaultsSpec creates a new LogsDrilldownDefaultsSpec object.
func NewLogsDrilldownDefaultsSpec() *LogsDrilldownDefaultsSpec {
	return &LogsDrilldownDefaultsSpec{
		DefaultFields: []string{},
	}
}
