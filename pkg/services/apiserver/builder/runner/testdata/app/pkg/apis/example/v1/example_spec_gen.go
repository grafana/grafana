package v1

// ExampleSpec defines model for ExampleSpec.
// +k8s:openapi-gen=true
type ExampleSpec struct {
	A string `json:"a"`
	B string `json:"b"`
}
