// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchBody struct {
	ApiVersion string        `json:"apiVersion"`
	Kind       string        `json:"kind"`
	Items      []interface{} `json:"items"`
}

// NewGetSearchBody creates a new GetSearchBody object.
func NewGetSearchBody() *GetSearchBody {
	return &GetSearchBody{
		Items: []interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchBody.
func (GetSearchBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchBody"
}
