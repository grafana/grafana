// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetSomethingBody struct {
	Namespace string `json:"namespace"`
	Message   string `json:"message"`
}

// NewGetSomethingBody creates a new GetSomethingBody object.
func NewGetSomethingBody() *GetSomethingBody {
	return &GetSomethingBody{}
}
