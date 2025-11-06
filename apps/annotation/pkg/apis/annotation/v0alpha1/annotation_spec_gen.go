// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationSpec struct {
	Text         string   `json:"text"`
	Time         int64    `json:"time"`
	TimeEnd      *int64   `json:"timeEnd,omitempty"`
	DashboardUID *string  `json:"dashboardUID,omitempty"`
	PanelID      *int64   `json:"panelID,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// NewAnnotationSpec creates a new AnnotationSpec object.
func NewAnnotationSpec() *AnnotationSpec {
	return &AnnotationSpec{}
}
