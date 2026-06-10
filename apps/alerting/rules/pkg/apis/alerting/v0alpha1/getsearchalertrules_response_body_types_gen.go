// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchAlertRulesAlertRuleHit struct {
	Type             GetSearchAlertRulesRuleSearchType `json:"type"`
	Annotations      map[string]string                 `json:"annotations,omitempty"`
	For              *string                           `json:"for,omitempty"`
	KeepFiringFor    *string                           `json:"keepFiringFor,omitempty"`
	DashboardUID     *string                           `json:"dashboardUID,omitempty"`
	PanelID          *int64                            `json:"panelID,omitempty"`
	Receiver         *string                           `json:"receiver,omitempty"`
	NotificationType *string                           `json:"notificationType,omitempty"`
	Name             string                            `json:"name"`
	Title            string                            `json:"title"`
	Folder           string                            `json:"folder"`
	Group            *string                           `json:"group,omitempty"`
	Interval         *string                           `json:"interval,omitempty"`
	Paused           *bool                             `json:"paused,omitempty"`
	Labels           map[string]string                 `json:"labels,omitempty"`
	RoutingTree      *string                           `json:"routingTree,omitempty"`
	DatasourceUIDs   []string                          `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchAlertRulesAlertRuleHit creates a new GetSearchAlertRulesAlertRuleHit object.
func NewGetSearchAlertRulesAlertRuleHit() *GetSearchAlertRulesAlertRuleHit {
	return &GetSearchAlertRulesAlertRuleHit{
		Type: GetSearchAlertRulesRuleSearchTypeAlertRule,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesAlertRuleHit.
func (GetSearchAlertRulesAlertRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesAlertRuleHit"
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
	Items []GetSearchAlertRulesAlertRuleHit `json:"items"`
}

// NewGetSearchAlertRulesBody creates a new GetSearchAlertRulesBody object.
func NewGetSearchAlertRulesBody() *GetSearchAlertRulesBody {
	return &GetSearchAlertRulesBody{
		Items: []GetSearchAlertRulesAlertRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesBody.
func (GetSearchAlertRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesBody"
}
