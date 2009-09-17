// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationSpec struct {
	// Core annotation content (required)
	Text string `json:"text"`
	// Time range
	// Start time (epoch milliseconds)
	Time int64 `json:"time"`
	// End time (epoch milliseconds) - optional for point annotations
	TimeEnd *int64 `json:"timeEnd,omitempty"`
	// Scoping - either organization or dashboard/panel level
	// Dashboard UID for dashboard-scoped annotations
	DashboardUID *string `json:"dashboardUID,omitempty"`
	// Panel ID for panel-scoped annotations
	PanelId *int64 `json:"panelId,omitempty"`
	// Alert-related fields
	// Legacy alert ID (deprecated, comment out if issues)
	AlertId *int64 `json:"alertId,omitempty"`
	// User-defined metadata
	// Array of tags for filtering/categorization
	Tags []string `json:"tags,omitempty"`
	// Additional arbitrary JSON data
	Data interface{} `json:"data,omitempty"`
	// Alert state tracking (for alert annotations)
	// Previous alert state
	PrevState *string `json:"prevState,omitempty"`
	// New alert state
	NewState *string `json:"newState,omitempty"`
}

// NewAnnotationSpec creates a new AnnotationSpec object.
func NewAnnotationSpec() *AnnotationSpec {
	return &AnnotationSpec{}
}
