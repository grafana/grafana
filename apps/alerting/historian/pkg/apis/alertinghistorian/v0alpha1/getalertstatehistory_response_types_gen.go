// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetAlertStateHistoryResponse struct {
	Body map[string]interface{} `json:"body"`
}

// NewGetAlertStateHistoryResponse creates a new GetAlertStateHistoryResponse object.
func NewGetAlertStateHistoryResponse() *GetAlertStateHistoryResponse {
	return &GetAlertStateHistoryResponse{
		Body: map[string]interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetAlertStateHistoryResponse.
func (GetAlertStateHistoryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.GetAlertStateHistoryResponse"
}
