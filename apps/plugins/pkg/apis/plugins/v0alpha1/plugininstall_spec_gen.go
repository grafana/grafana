// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginInstallSpec struct {
	Id      string                 `json:"id"`
	Version string                 `json:"version"`
	Url     string                 `json:"url"`
	Class   PluginInstallSpecClass `json:"class"`
}

// NewPluginInstallSpec creates a new PluginInstallSpec object.
func NewPluginInstallSpec() *PluginInstallSpec {
	return &PluginInstallSpec{}
}

// +k8s:openapi-gen=true
type PluginInstallSpecClass string

const (
	PluginInstallSpecClassCore     PluginInstallSpecClass = "core"
	PluginInstallSpecClassExternal PluginInstallSpecClass = "external"
	PluginInstallSpecClassCdn      PluginInstallSpecClass = "cdn"
)
