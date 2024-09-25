package v0alpha1

// TemplateGroupSpec defines model for TemplateGroupSpec.
// +k8s:openapi-gen=true
type TemplateGroupSpec struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}
