// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetAnnotationsBody struct {
	ApiVersion string        `json:"apiVersion"`
	Kind       string        `json:"kind"`
	Items      []interface{} `json:"items"`
}

// NewGetAnnotationsBody creates a new GetAnnotationsBody object.
func NewGetAnnotationsBody() *GetAnnotationsBody {
	return &GetAnnotationsBody{
		Items: []interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetAnnotationsBody.
func (GetAnnotationsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetAnnotationsBody"
}
