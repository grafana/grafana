// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRuleHit struct {
	Type           GetSearchRecordingRulesRuleSearchType `json:"type"`
	Name           string                                `json:"name"`
	Title          string                                `json:"title"`
	Folder         string                                `json:"folder"`
	Group          *string                               `json:"group,omitempty"`
	Paused         *bool                                 `json:"paused,omitempty"`
	Labels         map[string]string                     `json:"labels,omitempty"`
	DatasourceUIDs []string                              `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchRecordingRulesRuleHit creates a new GetSearchRecordingRulesRuleHit object.
func NewGetSearchRecordingRulesRuleHit() *GetSearchRecordingRulesRuleHit {
	return &GetSearchRecordingRulesRuleHit{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRuleHit.
func (GetSearchRecordingRulesRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRuleSearchType string

const (
	GetSearchRecordingRulesRuleSearchTypeAlertRule     GetSearchRecordingRulesRuleSearchType = "alertrule"
	GetSearchRecordingRulesRuleSearchTypeRecordingRule GetSearchRecordingRulesRuleSearchType = "recordingrule"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRuleSearchType.
func (GetSearchRecordingRulesRuleSearchType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRuleSearchType"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesBody struct {
	Items []GetSearchRecordingRulesRuleHit `json:"items"`
}

// NewGetSearchRecordingRulesBody creates a new GetSearchRecordingRulesBody object.
func NewGetSearchRecordingRulesBody() *GetSearchRecordingRulesBody {
	return &GetSearchRecordingRulesBody{
		Items: []GetSearchRecordingRulesRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesBody.
func (GetSearchRecordingRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesBody"
}
