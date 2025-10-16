// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginInstallSpec struct {
	PluginID string `json:"pluginID"`
	Version  string `json:"version"`
	Url      string `json:"url"`
}

// NewPluginInstallSpec creates a new PluginInstallSpec object.
func NewPluginInstallSpec() *PluginInstallSpec {
	return &PluginInstallSpec{}
}
