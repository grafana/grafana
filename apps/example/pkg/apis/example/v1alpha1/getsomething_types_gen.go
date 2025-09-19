// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetSomething struct {
	Namespace string `json:"namespace"`
	Message   string `json:"message"`
}

// NewGetSomething creates a new GetSomething object.
func NewGetSomething() *GetSomething {
	return &GetSomething{}
}
