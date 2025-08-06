// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginInstallSpec struct {
	Id      string `json:"id"`
	Version string `json:"version"`
}

// NewPluginInstallSpec creates a new PluginInstallSpec object.
func NewPluginInstallSpec() *PluginInstallSpec {
	return &PluginInstallSpec{}
}
