// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CheckSpec struct {
	// Generic data input that a check can receive
	Data map[string]string `json:"data,omitempty"`
}

// NewCheckSpec creates a new CheckSpec object.
func NewCheckSpec() *CheckSpec {
	return &CheckSpec{}
}
