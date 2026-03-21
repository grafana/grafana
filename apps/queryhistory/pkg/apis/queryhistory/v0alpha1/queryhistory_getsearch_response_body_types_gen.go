// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchBody struct {
	Items      []interface{} `json:"items"`
	TotalCount *int64        `json:"totalCount,omitempty"`
}

// NewGetSearchBody creates a new GetSearchBody object.
func NewGetSearchBody() *GetSearchBody {
	return &GetSearchBody{
		Items: []interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchBody.
func (GetSearchBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.queryhistory.pkg.apis.queryhistory.v0alpha1.GetSearchBody"
}
