// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
// +k8s:openapi-gen=true
type DummySpec struct {
	DummyField int64 `json:"dummyField"`
}

// NewDummySpec creates a new DummySpec object.
func NewDummySpec() *DummySpec {
	return &DummySpec{}
}
