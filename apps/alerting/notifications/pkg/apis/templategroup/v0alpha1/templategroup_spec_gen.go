// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type Spec struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}
