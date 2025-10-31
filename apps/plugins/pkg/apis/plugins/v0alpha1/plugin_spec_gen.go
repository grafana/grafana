// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginSpec struct {
	Id      string          `json:"id"`
	Version string          `json:"version"`
	Url     *string         `json:"url,omitempty"`
	Class   PluginSpecClass `json:"class"`
}

// NewPluginSpec creates a new PluginSpec object.
func NewPluginSpec() *PluginSpec {
	return &PluginSpec{}
}

// +k8s:openapi-gen=true
type PluginSpecClass string

const (
	PluginSpecClassCore     PluginSpecClass = "core"
	PluginSpecClassExternal PluginSpecClass = "external"
	PluginSpecClassCdn      PluginSpecClass = "cdn"
)
