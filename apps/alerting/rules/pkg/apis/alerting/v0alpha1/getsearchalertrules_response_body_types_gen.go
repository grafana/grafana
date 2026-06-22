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

// FacetResult is the distinct-term breakdown for one faceted field, e.g. the
// per-folder rule counts returned for facet=folder.
// +k8s:openapi-gen=true
type GetSearchAlertRulesFacetResult struct {
	Field   string                         `json:"field"`
	Total   int64                          `json:"total"`
	Missing int64                          `json:"missing"`
	Terms   []GetSearchAlertRulesTermFacet `json:"terms,omitempty"`
}

// NewGetSearchAlertRulesFacetResult creates a new GetSearchAlertRulesFacetResult object.
func NewGetSearchAlertRulesFacetResult() *GetSearchAlertRulesFacetResult {
	return &GetSearchAlertRulesFacetResult{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesFacetResult.
func (GetSearchAlertRulesFacetResult) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesFacetResult"
}

// TermFacet is a single faceted term and the number of matching rules.
// +k8s:openapi-gen=true
type GetSearchAlertRulesTermFacet struct {
	Term  string `json:"term"`
	Count int64  `json:"count"`
}

// NewGetSearchAlertRulesTermFacet creates a new GetSearchAlertRulesTermFacet object.
func NewGetSearchAlertRulesTermFacet() *GetSearchAlertRulesTermFacet {
	return &GetSearchAlertRulesTermFacet{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesTermFacet.
func (GetSearchAlertRulesTermFacet) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesTermFacet"
}

// +k8s:openapi-gen=true
type GetSearchAlertRulesBody struct {
	Items  []GetSearchAlertRulesAlertRuleHit         `json:"items"`
	Facets map[string]GetSearchAlertRulesFacetResult `json:"facets,omitempty"`
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
