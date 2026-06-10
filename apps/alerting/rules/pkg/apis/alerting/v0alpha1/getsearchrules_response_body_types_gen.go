// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchRulesRuleHit struct {
	Type           GetSearchRulesRuleSearchType `json:"type"`
	Name           string                       `json:"name"`
	Title          string                       `json:"title"`
	Folder         string                       `json:"folder"`
	Group          *string                      `json:"group,omitempty"`
	Paused         *bool                        `json:"paused,omitempty"`
	Labels         map[string]string            `json:"labels,omitempty"`
	DatasourceUIDs []string                     `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchRulesRuleHit creates a new GetSearchRulesRuleHit object.
func NewGetSearchRulesRuleHit() *GetSearchRulesRuleHit {
	return &GetSearchRulesRuleHit{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRuleHit.
func (GetSearchRulesRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchRulesRuleSearchType string

const (
	GetSearchRulesRuleSearchTypeAlertRule     GetSearchRulesRuleSearchType = "alertrule"
	GetSearchRulesRuleSearchTypeRecordingRule GetSearchRulesRuleSearchType = "recordingrule"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRuleSearchType.
func (GetSearchRulesRuleSearchType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRuleSearchType"
}

// +k8s:openapi-gen=true
type GetSearchRulesBody struct {
	Items []GetSearchRulesRuleHit `json:"items"`
}

// NewGetSearchRulesBody creates a new GetSearchRulesBody object.
func NewGetSearchRulesBody() *GetSearchRulesBody {
	return &GetSearchRulesBody{
		Items: []GetSearchRulesRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesBody.
func (GetSearchRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesBody"
}
