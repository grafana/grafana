// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationSpec struct {
	// Text of the annotation.
	Text string `json:"text"`
	// Start time of the annotation, in Unix milliseconds.
	Time int64 `json:"time"`
	// End time of the annotation, in Unix milliseconds.
	// Optional. Set it to make the annotation a region.
	TimeEnd *int64 `json:"timeEnd,omitempty"`
	// UID of the dashboard the annotation belongs to.
	// Optional. Omit it for an organization-wide annotation.
	DashboardUID *string `json:"dashboardUID,omitempty"`
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Optional. Omit it to show the annotation on every panel of the dashboard.
	PanelID *int64 `json:"panelID,omitempty"`
	// Tags used to categorize and filter annotations.
	Tags []string `json:"tags,omitempty"`
	// Names of the scopes the annotation applies to.
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
