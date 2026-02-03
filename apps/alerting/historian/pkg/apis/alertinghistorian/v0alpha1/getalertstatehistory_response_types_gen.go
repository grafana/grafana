// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetAlertstatehistoryBody struct {
	Body map[string]interface{} `json:"body"`
}

// NewGetAlertstatehistoryBody creates a new GetAlertstatehistoryBody object.
func NewGetAlertstatehistoryBody() *GetAlertstatehistoryBody {
	return &GetAlertstatehistoryBody{
		Body: map[string]interface{}{},
	}
}
func (GetAlertstatehistoryBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.GetAlertstatehistoryBody"
}
