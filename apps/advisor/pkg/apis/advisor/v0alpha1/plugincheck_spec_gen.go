// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginCheckSpec struct {
	// Generic data input that a check can receive
	Data map[string]string `json:"data,omitempty"`
}

// NewPluginCheckSpec creates a new PluginCheckSpec object.
func NewPluginCheckSpec() *PluginCheckSpec {
	return &PluginCheckSpec{}
}
