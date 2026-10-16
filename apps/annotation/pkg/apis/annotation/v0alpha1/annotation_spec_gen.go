// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationSpec struct {
	// Text of the annotation.
	Text string `json:"text"`
	// Start time of the annotation, in milliseconds since the Unix epoch.
	Time int64 `json:"time"`
	// End time of the annotation, in milliseconds since the Unix epoch.
	// Set it to make the annotation a region. Omit it, or set it to the same value as time, for a point-in-time annotation.
	TimeEnd *int64 `json:"timeEnd,omitempty"`
	// UID of the dashboard the annotation belongs to. Omit it for an organization-wide annotation.
	DashboardUID *string `json:"dashboardUID,omitempty"`
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Omit it to show the annotation on every panel of the dashboard.
	PanelID *int64 `json:"panelID,omitempty"`
	// Tags used to categorize and filter annotations.
	Tags []string `json:"tags,omitempty"`
	// Names of the scopes the annotation applies to. The server limits how many scopes an annotation can have (5 by default).
	Scopes []string `json:"scopes,omitempty"`
}

// NewAnnotationSpec creates a new AnnotationSpec object.
func NewAnnotationSpec() *AnnotationSpec {
	return &AnnotationSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AnnotationSpec.
func (AnnotationSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.AnnotationSpec"
}
