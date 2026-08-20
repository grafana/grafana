// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// #SearchResultsMetadata carries the paging token and total authorised match
// count.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1SearchResultsMetadata struct {
	// continue is an opaque token for the next page. Clients must not inspect or
	// construct it.
	Continue *string `json:"continue,omitempty"`
	// totalHits counts the rules matching the query. Always read it together
	// with totalHitsRelation, which says whether the count is exact.
	TotalHits         int64                                            `json:"totalHits"`
	TotalHitsRelation ListRecordingRuleSearchV0alpha1TotalHitsRelation `json:"totalHitsRelation"`
}

// NewListRecordingRuleSearchV0alpha1SearchResultsMetadata creates a new ListRecordingRuleSearchV0alpha1SearchResultsMetadata object.
func NewListRecordingRuleSearchV0alpha1SearchResultsMetadata() *ListRecordingRuleSearchV0alpha1SearchResultsMetadata {
	return &ListRecordingRuleSearchV0alpha1SearchResultsMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1SearchResultsMetadata.
func (ListRecordingRuleSearchV0alpha1SearchResultsMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1SearchResultsMetadata"
}

// #TotalHitsRelation says how totalHits relates to the real number of matching
// rules the caller may see: "eq" when it is exact, "lte" when it is an upper
// bound because authorisation was applied after the search ranked its results.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1TotalHitsRelation string

const (
	ListRecordingRuleSearchV0alpha1TotalHitsRelationEq  ListRecordingRuleSearchV0alpha1TotalHitsRelation = "eq"
	ListRecordingRuleSearchV0alpha1TotalHitsRelationLte ListRecordingRuleSearchV0alpha1TotalHitsRelation = "lte"
)

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1TotalHitsRelation.
func (ListRecordingRuleSearchV0alpha1TotalHitsRelation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1TotalHitsRelation"
}

// #SearchResultHit is a single match: its identity, an optional relevance score
// (present only when a text query was evaluated), and the requested fields.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1SearchResultHit struct {
	Resource ListRecordingRuleSearchV0alpha1SearchResultResource `json:"resource"`
	Score    *float64                                            `json:"score,omitempty"`
	// fields holds the JSON values for the requested (or default) fields.
	// Deliberately an open object rather than a per-kind union: the generic
	// endpoint returns the field values unstructured, so declaring them here
	// would make the schema narrow now and widen at migration.
	Fields map[string]interface{} `json:"fields,omitempty"`
}

// NewListRecordingRuleSearchV0alpha1SearchResultHit creates a new ListRecordingRuleSearchV0alpha1SearchResultHit object.
func NewListRecordingRuleSearchV0alpha1SearchResultHit() *ListRecordingRuleSearchV0alpha1SearchResultHit {
	return &ListRecordingRuleSearchV0alpha1SearchResultHit{
		Resource: *NewListRecordingRuleSearchV0alpha1SearchResultResource(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1SearchResultHit.
func (ListRecordingRuleSearchV0alpha1SearchResultHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1SearchResultHit"
}

// #SearchResultResource is the full identity of a hit. The namespace is implicit
// from the URL and omitted.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1SearchResultResource struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// NewListRecordingRuleSearchV0alpha1SearchResultResource creates a new ListRecordingRuleSearchV0alpha1SearchResultResource object.
func NewListRecordingRuleSearchV0alpha1SearchResultResource() *ListRecordingRuleSearchV0alpha1SearchResultResource {
	return &ListRecordingRuleSearchV0alpha1SearchResultResource{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1SearchResultResource.
func (ListRecordingRuleSearchV0alpha1SearchResultResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1SearchResultResource"
}

// #FacetValue is a single facet term and its count.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1FacetValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

// NewListRecordingRuleSearchV0alpha1FacetValue creates a new ListRecordingRuleSearchV0alpha1FacetValue object.
func NewListRecordingRuleSearchV0alpha1FacetValue() *ListRecordingRuleSearchV0alpha1FacetValue {
	return &ListRecordingRuleSearchV0alpha1FacetValue{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1FacetValue.
func (ListRecordingRuleSearchV0alpha1FacetValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1FacetValue"
}

// +k8s:openapi-gen=true
type ListRecordingRuleSearchV0alpha1Body struct {
	Metadata ListRecordingRuleSearchV0alpha1SearchResultsMetadata `json:"metadata"`
	Items    []ListRecordingRuleSearchV0alpha1SearchResultHit     `json:"items"`
	// facets holds term counts per requested facet field. Counts are computed
	// over a bounded sample window, so they are best-effort.
	Facets map[string][]ListRecordingRuleSearchV0alpha1FacetValue `json:"facets,omitempty"`
}

// NewListRecordingRuleSearchV0alpha1Body creates a new ListRecordingRuleSearchV0alpha1Body object.
func NewListRecordingRuleSearchV0alpha1Body() *ListRecordingRuleSearchV0alpha1Body {
	return &ListRecordingRuleSearchV0alpha1Body{
		Metadata: *NewListRecordingRuleSearchV0alpha1SearchResultsMetadata(),
		Items:    []ListRecordingRuleSearchV0alpha1SearchResultHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchV0alpha1Body.
func (ListRecordingRuleSearchV0alpha1Body) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchV0alpha1Body"
}
