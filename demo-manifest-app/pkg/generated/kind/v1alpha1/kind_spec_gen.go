// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type Spec struct {
	// apiGroup is the first label of the declared kind's group. It must be a DNS label.
	ApiGroup string `json:"apiGroup"`
	// name is the declared kind's name, such as Widget.
	Name string `json:"name"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}

// OpenAPIModelName returns the OpenAPI model name for Spec.
func (Spec) OpenAPIModelName() string {
	return "com.github.demo.manifest.pkg.generated.kind.v1alpha1.Spec"
}
