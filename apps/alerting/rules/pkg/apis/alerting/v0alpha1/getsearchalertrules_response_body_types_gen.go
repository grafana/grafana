// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchAlertRulesRuleHit struct {
	Type           GetSearchAlertRulesRuleSearchType `json:"type"`
	Name           string                            `json:"name"`
	Title          string                            `json:"title"`
	Folder         string                            `json:"folder"`
	Group          *string                           `json:"group,omitempty"`
	Paused         *bool                             `json:"paused,omitempty"`
	Labels         map[string]string                 `json:"labels,omitempty"`
	DatasourceUIDs []string                          `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchAlertRulesRuleHit creates a new GetSearchAlertRulesRuleHit object.
func NewGetSearchAlertRulesRuleHit() *GetSearchAlertRulesRuleHit {
	return &GetSearchAlertRulesRuleHit{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesRuleHit.
func (GetSearchAlertRulesRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesRuleSearchType string

const (
	GetSearchAlertRulesRuleSearchTypeAlertRule     GetSearchAlertRulesRuleSearchType = "alertrule"
	GetSearchAlertRulesRuleSearchTypeRecordingRule GetSearchAlertRulesRuleSearchType = "recordingrule"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesRuleSearchType.
func (GetSearchAlertRulesRuleSearchType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRuleSearchType"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesBody struct {
	Items []GetSearchAlertRulesRuleHit `json:"items"`
}

// NewGetSearchAlertRulesBody creates a new GetSearchAlertRulesBody object.
func NewGetSearchAlertRulesBody() *GetSearchAlertRulesBody {
	return &GetSearchAlertRulesBody{
		Items: []GetSearchAlertRulesRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesBody.
func (GetSearchAlertRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesBody"
}
