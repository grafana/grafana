// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// #SearchResultsMetadata carries the paging token and total authorised match
// count.
// +k8s:openapi-gen=true
type CreateSearchRulesSearchResultsMetadata struct {
	Continue  *string `json:"continue,omitempty"`
	TotalHits *int64  `json:"totalHits,omitempty"`
}

// NewCreateSearchRulesSearchResultsMetadata creates a new CreateSearchRulesSearchResultsMetadata object.
func NewCreateSearchRulesSearchResultsMetadata() *CreateSearchRulesSearchResultsMetadata {
	return &CreateSearchRulesSearchResultsMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesSearchResultsMetadata.
func (CreateSearchRulesSearchResultsMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesSearchResultsMetadata"
}

// #SearchResultHit is a single match: its identity, an optional relevance
// score (present only when the query included free text), and the requested
// fields.
// +k8s:openapi-gen=true
type CreateSearchRulesSearchResultHit struct {
	Resource CreateSearchRulesSearchResultResource `json:"resource"`
	Score    *float64                              `json:"score,omitempty"`
	Fields   CreateSearchRulesRuleSearchHitFields  `json:"fields"`
}

// NewCreateSearchRulesSearchResultHit creates a new CreateSearchRulesSearchResultHit object.
func NewCreateSearchRulesSearchResultHit() *CreateSearchRulesSearchResultHit {
	return &CreateSearchRulesSearchResultHit{
		Resource: *NewCreateSearchRulesSearchResultResource(),
		Fields:   *NewCreateSearchRulesRuleSearchHitFields(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesSearchResultHit.
func (CreateSearchRulesSearchResultHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesSearchResultHit"
}

// #SearchResultResource is the full identity of a hit.
// +k8s:openapi-gen=true
type CreateSearchRulesSearchResultResource struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// NewCreateSearchRulesSearchResultResource creates a new CreateSearchRulesSearchResultResource object.
func NewCreateSearchRulesSearchResultResource() *CreateSearchRulesSearchResultResource {
	return &CreateSearchRulesSearchResultResource{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesSearchResultResource.
func (CreateSearchRulesSearchResultResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesSearchResultResource"
}

// #RuleSearchHitFields is the per-kind field payload returned on each hit.
// It carries the union of alert- and recording-rule search fields; only the
// fields relevant to a hit's kind are populated. This maps to the kind's
// declared searchFields.
// +k8s:openapi-gen=true
type CreateSearchRulesRuleSearchHitFields struct {
	Title          *string           `json:"title,omitempty"`
	Folder         *string           `json:"folder,omitempty"`
	Type           *string           `json:"type,omitempty"`
	Interval       *string           `json:"interval,omitempty"`
	Paused         *bool             `json:"paused,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
	DatasourceUIDs []string          `json:"datasourceUIDs,omitempty"`
	// Alert-rule fields.
	Annotations      map[string]string `json:"annotations,omitempty"`
	For              *string           `json:"for,omitempty"`
	KeepFiringFor    *string           `json:"keepFiringFor,omitempty"`
	DashboardUID     *string           `json:"dashboardUID,omitempty"`
	PanelID          *int64            `json:"panelID,omitempty"`
	Receiver         *string           `json:"receiver,omitempty"`
	NotificationType *string           `json:"notificationType,omitempty"`
	RoutingTree      *string           `json:"routingTree,omitempty"`
	// Recording-rule fields.
	Metric              *string `json:"metric,omitempty"`
	TargetDatasourceUID *string `json:"targetDatasourceUID,omitempty"`
}

// NewCreateSearchRulesRuleSearchHitFields creates a new CreateSearchRulesRuleSearchHitFields object.
func NewCreateSearchRulesRuleSearchHitFields() *CreateSearchRulesRuleSearchHitFields {
	return &CreateSearchRulesRuleSearchHitFields{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRuleSearchHitFields.
func (CreateSearchRulesRuleSearchHitFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRuleSearchHitFields"
}

// #FacetValue is a single value/count pair in a facet breakdown.
// +k8s:openapi-gen=true
type CreateSearchRulesFacetValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

// NewCreateSearchRulesFacetValue creates a new CreateSearchRulesFacetValue object.
func NewCreateSearchRulesFacetValue() *CreateSearchRulesFacetValue {
	return &CreateSearchRulesFacetValue{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesFacetValue.
func (CreateSearchRulesFacetValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesFacetValue"
}

// listMeta is intentionally omitted: #SearchResults carries its
// own metadata (continue, totalHits) mirroring the generic
// search.grafana.app SearchResults envelope.
// +k8s:openapi-gen=true
type CreateSearchRulesBody struct {
	Metadata CreateSearchRulesSearchResultsMetadata   `json:"metadata"`
	Items    []CreateSearchRulesSearchResultHit       `json:"items"`
	Facets   map[string][]CreateSearchRulesFacetValue `json:"facets,omitempty"`
}

// NewCreateSearchRulesBody creates a new CreateSearchRulesBody object.
func NewCreateSearchRulesBody() *CreateSearchRulesBody {
	return &CreateSearchRulesBody{
		Metadata: *NewCreateSearchRulesSearchResultsMetadata(),
		Items:    []CreateSearchRulesSearchResultHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesBody.
func (CreateSearchRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesBody"
}
