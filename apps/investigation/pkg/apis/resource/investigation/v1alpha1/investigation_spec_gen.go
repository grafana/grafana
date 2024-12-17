// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
// +k8s:openapi-gen=true
type Spec struct {
	Title string `json:"title"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}
