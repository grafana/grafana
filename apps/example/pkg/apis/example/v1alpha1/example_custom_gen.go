// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// Custom is a subresource that will be stored the same way status is stored,
// and requires using the /custom route to update.
// Its content is returned as part of a GET to the resource itself, just like with status.
// To route a subresource to an arbitrary handler, use the 'routes' field instead (see below).
// metadata if where kind- and schema-specific metadata goes. This is converted into typed annotations
// with getters and setters by the code generation.
//
//	metadata: {
//		kindSpecificField: string
//	}
//
// +k8s:openapi-gen=true
type ExampleCustom struct {
	MyField    string `json:"myField"`
	OtherField string `json:"otherField"`
}

// NewExampleCustom creates a new ExampleCustom object.
func NewExampleCustom() *ExampleCustom {
	return &ExampleCustom{}
}
