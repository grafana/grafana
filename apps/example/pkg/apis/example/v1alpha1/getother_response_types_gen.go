// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetOtherResponse struct {
	Message string `json:"message"`
}

// NewGetOtherResponse creates a new GetOtherResponse object.
func NewGetOtherResponse() *GetOtherResponse {
	return &GetOtherResponse{}
}
func (GetOtherResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v1alpha1.GetOtherResponse"
}
