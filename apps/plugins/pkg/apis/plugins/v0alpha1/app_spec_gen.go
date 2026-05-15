// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AppSpec struct {
	Enabled bool `json:"enabled"`
	Pinned  bool `json:"pinned"`
}

// NewAppSpec creates a new AppSpec object.
func NewAppSpec() *AppSpec {
	return &AppSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AppSpec.
func (AppSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.plugins.pkg.apis.plugins.v0alpha1.AppSpec"
}
