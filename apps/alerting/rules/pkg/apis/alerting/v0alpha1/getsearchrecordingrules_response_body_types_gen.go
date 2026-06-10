// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchRecordingRulesRecordingRuleHit struct {
	Type                GetSearchRecordingRulesRuleSearchType `json:"type"`
	Metric              *string                               `json:"metric,omitempty"`
	Name                string                                `json:"name"`
	Title               string                                `json:"title"`
	Folder              string                                `json:"folder"`
	Group               *string                               `json:"group,omitempty"`
	Paused              *bool                                 `json:"paused,omitempty"`
	Labels              map[string]string                     `json:"labels,omitempty"`
	TargetDatasourceUID *string                               `json:"targetDatasourceUID,omitempty"`
	DatasourceUIDs      []string                              `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchRecordingRulesRecordingRuleHit creates a new GetSearchRecordingRulesRecordingRuleHit object.
func NewGetSearchRecordingRulesRecordingRuleHit() *GetSearchRecordingRulesRecordingRuleHit {
	return &GetSearchRecordingRulesRecordingRuleHit{
		Type: GetSearchRecordingRulesRuleSearchTypeRecordingRule,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRecordingRuleHit.
func (GetSearchRecordingRulesRecordingRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRecordingRuleHit"
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
	Items []GetSearchRecordingRulesRecordingRuleHit `json:"items"`
}

// NewGetSearchRecordingRulesBody creates a new GetSearchRecordingRulesBody object.
func NewGetSearchRecordingRulesBody() *GetSearchRecordingRulesBody {
	return &GetSearchRecordingRulesBody{
		Items: []GetSearchRecordingRulesRecordingRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesBody.
func (GetSearchRecordingRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesBody"
}
