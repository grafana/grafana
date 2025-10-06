// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeDashboardBindingStatus struct {
	// DashboardTitle should be populated and update from the dashboard
	DashboardTitle string `json:"dashboardTitle"`
	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`
}

// NewScopeDashboardBindingStatus creates a new ScopeDashboardBindingStatus object.
func NewScopeDashboardBindingStatus() *ScopeDashboardBindingStatus {
	return &ScopeDashboardBindingStatus{}
}
