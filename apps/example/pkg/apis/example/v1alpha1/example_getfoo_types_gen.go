// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// The response type for the GET /foo method. This will generate a go type, and will also be used for the OpenAPI definition for the route.
// +k8s:openapi-gen=true
type GetFoo struct {
	Message string `json:"message"`
}

// NewGetFoo creates a new GetFoo object.
func NewGetFoo() *GetFoo {
	return &GetFoo{}
}
