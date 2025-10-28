// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// #DefinedType is a re-usable definition for us to use in our schema.
// Fields leading with # are definitions in CUE and won't be included in the generated types.
// +k8s:openapi-gen=true
type ExampleDefinedType struct {
	// Info is information about this entry. This comment, like all comments
	// on fields or definitions, will be copied into the generated types as well.
	Info string `json:"info"`
	// Next is an optional next element in the DefinedType, allowing for a self-referential
	// linked-list like structure. The ? in the field makes this optional.
	Next *ExampleDefinedType `json:"next,omitempty"`
}

// NewExampleDefinedType creates a new ExampleDefinedType object.
func NewExampleDefinedType() *ExampleDefinedType {
	return &ExampleDefinedType{}
}

// Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
// +k8s:openapi-gen=true
type ExampleSpec struct {
	// Example fields
	FirstField  string              `json:"firstField"`
	SecondField int64               `json:"secondField"`
	List        *ExampleDefinedType `json:"list,omitempty"`
}

// NewExampleSpec creates a new ExampleSpec object.
func NewExampleSpec() *ExampleSpec {
	return &ExampleSpec{}
}
