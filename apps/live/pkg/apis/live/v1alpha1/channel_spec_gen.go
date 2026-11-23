// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ChannelSpec struct {
	// The channel path, for example stream/telegraf/cpu
	Path string `json:"path"`
}

// NewChannelSpec creates a new ChannelSpec object.
func NewChannelSpec() *ChannelSpec {
	return &ChannelSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ChannelSpec.
func (ChannelSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.live.pkg.apis.live.v1alpha1.ChannelSpec"
}
