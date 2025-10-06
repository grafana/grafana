// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeNavigationStatus struct {
	// Title should be populated and update from the dashboard
	Title string `json:"title"`
	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`
}

// NewScopeNavigationStatus creates a new ScopeNavigationStatus object.
func NewScopeNavigationStatus() *ScopeNavigationStatus {
	return &ScopeNavigationStatus{}
}
