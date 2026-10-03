// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata struct {
	// Opaque next-page token; clients must not construct it.
	Continue *string `json:"continue,omitempty"`
	// Interpret with totalHitsRelation, not as an exact count unconditionally.
	TotalHits         int64                                             `json:"totalHits"`
	TotalHitsRelation ListAlertRuleSearchRulesV0alpha1TotalHitsRelation `json:"totalHitsRelation"`
}

// NewListAlertRuleSearchRulesV0alpha1SearchResultsMetadata creates a new ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata object.
func NewListAlertRuleSearchRulesV0alpha1SearchResultsMetadata() *ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata {
	return &ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata.
func (ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata"
}

// "eq" means exact; "lte" means totalHits is an upper bound after authorisation.
// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1TotalHitsRelation string

const (
	ListAlertRuleSearchRulesV0alpha1TotalHitsRelationEq  ListAlertRuleSearchRulesV0alpha1TotalHitsRelation = "eq"
	ListAlertRuleSearchRulesV0alpha1TotalHitsRelationLte ListAlertRuleSearchRulesV0alpha1TotalHitsRelation = "lte"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1TotalHitsRelation.
func (ListAlertRuleSearchRulesV0alpha1TotalHitsRelation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1TotalHitsRelation"
}

// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1SearchResultHit struct {
	Resource ListAlertRuleSearchRulesV0alpha1SearchResultResource `json:"resource"`
	// Present only when a text query was evaluated.
	Score *float64 `json:"score,omitempty"`
	// Open to match the generic endpoint's unstructured field values.
	Fields map[string]interface{} `json:"fields,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1SearchResultHit creates a new ListAlertRuleSearchRulesV0alpha1SearchResultHit object.
func NewListAlertRuleSearchRulesV0alpha1SearchResultHit() *ListAlertRuleSearchRulesV0alpha1SearchResultHit {
	return &ListAlertRuleSearchRulesV0alpha1SearchResultHit{
		Resource: *NewListAlertRuleSearchRulesV0alpha1SearchResultResource(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1SearchResultHit.
func (ListAlertRuleSearchRulesV0alpha1SearchResultHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1SearchResultHit"
}

// Namespace is implicit in the URL.
// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1SearchResultResource struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// NewListAlertRuleSearchRulesV0alpha1SearchResultResource creates a new ListAlertRuleSearchRulesV0alpha1SearchResultResource object.
func NewListAlertRuleSearchRulesV0alpha1SearchResultResource() *ListAlertRuleSearchRulesV0alpha1SearchResultResource {
	return &ListAlertRuleSearchRulesV0alpha1SearchResultResource{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1SearchResultResource.
func (ListAlertRuleSearchRulesV0alpha1SearchResultResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1SearchResultResource"
}

// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1FacetValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

// NewListAlertRuleSearchRulesV0alpha1FacetValue creates a new ListAlertRuleSearchRulesV0alpha1FacetValue object.
func NewListAlertRuleSearchRulesV0alpha1FacetValue() *ListAlertRuleSearchRulesV0alpha1FacetValue {
	return &ListAlertRuleSearchRulesV0alpha1FacetValue{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1FacetValue.
func (ListAlertRuleSearchRulesV0alpha1FacetValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1FacetValue"
}

// SearchResults supplies its own metadata; omit listMeta.
// +k8s:openapi-gen=true
type ListAlertRuleSearchRulesV0alpha1Body struct {
	Metadata ListAlertRuleSearchRulesV0alpha1SearchResultsMetadata `json:"metadata"`
	Items    []ListAlertRuleSearchRulesV0alpha1SearchResultHit     `json:"items"`
	// Counts use a bounded sample and are best-effort.
	Facets map[string][]ListAlertRuleSearchRulesV0alpha1FacetValue `json:"facets,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1Body creates a new ListAlertRuleSearchRulesV0alpha1Body object.
func NewListAlertRuleSearchRulesV0alpha1Body() *ListAlertRuleSearchRulesV0alpha1Body {
	return &ListAlertRuleSearchRulesV0alpha1Body{
		Metadata: *NewListAlertRuleSearchRulesV0alpha1SearchResultsMetadata(),
		Items:    []ListAlertRuleSearchRulesV0alpha1SearchResultHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1Body.
func (ListAlertRuleSearchRulesV0alpha1Body) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1Body"
}
