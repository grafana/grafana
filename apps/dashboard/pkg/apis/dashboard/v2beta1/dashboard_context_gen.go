// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

// +k8s:openapi-gen=true
type DashboardContext struct {
	// Default layout that would be used when adding new containers (rows, tabs)
	DefaultLayoutType *DashboardContextDefaultLayoutType `json:"defaultLayoutType,omitempty"`
}

// NewDashboardContext creates a new DashboardContext object.
func NewDashboardContext() *DashboardContext {
	return &DashboardContext{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardContext.
func (DashboardContext) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardContext"
}

// +k8s:openapi-gen=true
type DashboardContextDefaultLayoutType string

const (
	DashboardContextDefaultLayoutTypeGridLayout     DashboardContextDefaultLayoutType = "GridLayout"
	DashboardContextDefaultLayoutTypeAutoGridLayout DashboardContextDefaultLayoutType = "AutoGridLayout"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardContextDefaultLayoutType.
func (DashboardContextDefaultLayoutType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardContextDefaultLayoutType"
}
