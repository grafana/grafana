// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetAlertstatehistoryResponse struct {
	Body map[string]interface{} `json:"body"`
}

// NewGetAlertstatehistoryResponse creates a new GetAlertstatehistoryResponse object.
func NewGetAlertstatehistoryResponse() *GetAlertstatehistoryResponse {
	return &GetAlertstatehistoryResponse{
		Body: map[string]interface{}{},
	}
}
func (GetAlertstatehistoryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.GetAlertstatehistoryResponse"
}
