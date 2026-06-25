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
	Interval            *string                               `json:"interval,omitempty"`
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

// FacetResult is the distinct-term breakdown for one faceted field, e.g. the
// per-folder rule counts returned for facet=folder.
// +k8s:openapi-gen=true
type GetSearchRecordingRulesFacetResult struct {
	Field   string                             `json:"field"`
	Total   int64                              `json:"total"`
	Missing int64                              `json:"missing"`
	Terms   []GetSearchRecordingRulesTermFacet `json:"terms,omitempty"`
}

// NewGetSearchRecordingRulesFacetResult creates a new GetSearchRecordingRulesFacetResult object.
func NewGetSearchRecordingRulesFacetResult() *GetSearchRecordingRulesFacetResult {
	return &GetSearchRecordingRulesFacetResult{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesFacetResult.
func (GetSearchRecordingRulesFacetResult) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesFacetResult"
}

// TermFacet is a single faceted term and the number of matching rules.
// +k8s:openapi-gen=true
type GetSearchRecordingRulesTermFacet struct {
	Term  string `json:"term"`
	Count int64  `json:"count"`
}

// NewGetSearchRecordingRulesTermFacet creates a new GetSearchRecordingRulesTermFacet object.
func NewGetSearchRecordingRulesTermFacet() *GetSearchRecordingRulesTermFacet {
	return &GetSearchRecordingRulesTermFacet{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesTermFacet.
func (GetSearchRecordingRulesTermFacet) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesTermFacet"
}

// +k8s:openapi-gen=true
type GetSearchRecordingRulesBody struct {
	Items  []GetSearchRecordingRulesRecordingRuleHit     `json:"items"`
	Facets map[string]GetSearchRecordingRulesFacetResult `json:"facets,omitempty"`
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
