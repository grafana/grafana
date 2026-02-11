// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
// +k8s:openapi-gen=true
type ExampleSpec struct {
	FirstField int64 `json:"firstField"`
}

// NewExampleSpec creates a new ExampleSpec object.
func NewExampleSpec() *ExampleSpec {
	return &ExampleSpec{}
}
func (ExampleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v0alpha1.ExampleSpec"
}
