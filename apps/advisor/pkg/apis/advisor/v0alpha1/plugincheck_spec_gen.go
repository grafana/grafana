// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginCheckSpec struct {
	// This can be customized per check
	Data map[string]string `json:"data,omitempty"`
}

// NewPluginCheckSpec creates a new PluginCheckSpec object.
func NewPluginCheckSpec() *PluginCheckSpec {
	return &PluginCheckSpec{}
}
