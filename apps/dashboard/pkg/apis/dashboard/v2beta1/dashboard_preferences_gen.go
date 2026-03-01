// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

// +k8s:openapi-gen=true
type DashboardPreferences struct {
	// Default layout that would be used when adding new elements
	DefaultLayout *string `json:"defaultLayout,omitempty"`
}

// NewDashboardPreferences creates a new DashboardPreferences object.
func NewDashboardPreferences() *DashboardPreferences {
	return &DashboardPreferences{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferences.
func (DashboardPreferences) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferences"
}
