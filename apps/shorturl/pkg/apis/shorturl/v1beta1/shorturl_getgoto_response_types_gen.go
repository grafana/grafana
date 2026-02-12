// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type GetGotoResponse struct {
	Url string `json:"url"`
}

// NewGetGotoResponse creates a new GetGotoResponse object.
func NewGetGotoResponse() *GetGotoResponse {
	return &GetGotoResponse{}
}
func (GetGotoResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.shorturl.pkg.apis.shorturl.v1beta1.GetGotoResponse"
}
