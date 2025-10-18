// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TemplateGroupSpec struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// NewTemplateGroupSpec creates a new TemplateGroupSpec object.
func NewTemplateGroupSpec() *TemplateGroupSpec {
	return &TemplateGroupSpec{}
}
