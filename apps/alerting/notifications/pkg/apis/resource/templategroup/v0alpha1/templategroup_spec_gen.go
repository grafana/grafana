package v0alpha1

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type Spec struct {
	Content string `json:"content"`
	Title   string `json:"title"`
}
