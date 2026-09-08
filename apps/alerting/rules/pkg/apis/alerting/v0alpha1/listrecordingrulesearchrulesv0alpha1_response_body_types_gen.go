// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata struct {
	// Opaque next-page token; clients must not construct it.
	Continue *string `json:"continue,omitempty"`
	// Interpret with totalHitsRelation, not as an exact count unconditionally.
	TotalHits         int64                                                 `json:"totalHits"`
	TotalHitsRelation ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation `json:"totalHitsRelation"`
}

// NewListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata creates a new ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata object.
func NewListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata() *ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata {
	return &ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata.
func (ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata"
}

// "eq" means exact; "lte" means totalHits is an upper bound after authorisation.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation string

const (
	ListRecordingRuleSearchRulesV0alpha1TotalHitsRelationEq  ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation = "eq"
	ListRecordingRuleSearchRulesV0alpha1TotalHitsRelationLte ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation = "lte"
)

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation.
func (ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1TotalHitsRelation"
}

// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1SearchResultHit struct {
	Resource ListRecordingRuleSearchRulesV0alpha1SearchResultResource `json:"resource"`
	// Present only when a text query was evaluated.
	Score *float64 `json:"score,omitempty"`
	// Open to match the generic endpoint's unstructured field values.
	Fields map[string]interface{} `json:"fields,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1SearchResultHit creates a new ListRecordingRuleSearchRulesV0alpha1SearchResultHit object.
func NewListRecordingRuleSearchRulesV0alpha1SearchResultHit() *ListRecordingRuleSearchRulesV0alpha1SearchResultHit {
	return &ListRecordingRuleSearchRulesV0alpha1SearchResultHit{
		Resource: *NewListRecordingRuleSearchRulesV0alpha1SearchResultResource(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1SearchResultHit.
func (ListRecordingRuleSearchRulesV0alpha1SearchResultHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1SearchResultHit"
}

// Namespace is implicit in the URL.
// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1SearchResultResource struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// NewListRecordingRuleSearchRulesV0alpha1SearchResultResource creates a new ListRecordingRuleSearchRulesV0alpha1SearchResultResource object.
func NewListRecordingRuleSearchRulesV0alpha1SearchResultResource() *ListRecordingRuleSearchRulesV0alpha1SearchResultResource {
	return &ListRecordingRuleSearchRulesV0alpha1SearchResultResource{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1SearchResultResource.
func (ListRecordingRuleSearchRulesV0alpha1SearchResultResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1SearchResultResource"
}

// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1FacetValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

// NewListRecordingRuleSearchRulesV0alpha1FacetValue creates a new ListRecordingRuleSearchRulesV0alpha1FacetValue object.
func NewListRecordingRuleSearchRulesV0alpha1FacetValue() *ListRecordingRuleSearchRulesV0alpha1FacetValue {
	return &ListRecordingRuleSearchRulesV0alpha1FacetValue{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1FacetValue.
func (ListRecordingRuleSearchRulesV0alpha1FacetValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1FacetValue"
}

// +k8s:openapi-gen=true
type ListRecordingRuleSearchRulesV0alpha1Body struct {
	Metadata ListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata `json:"metadata"`
	Items    []ListRecordingRuleSearchRulesV0alpha1SearchResultHit     `json:"items"`
	// Counts use a bounded sample and are best-effort.
	Facets map[string][]ListRecordingRuleSearchRulesV0alpha1FacetValue `json:"facets,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1Body creates a new ListRecordingRuleSearchRulesV0alpha1Body object.
func NewListRecordingRuleSearchRulesV0alpha1Body() *ListRecordingRuleSearchRulesV0alpha1Body {
	return &ListRecordingRuleSearchRulesV0alpha1Body{
		Metadata: *NewListRecordingRuleSearchRulesV0alpha1SearchResultsMetadata(),
		Items:    []ListRecordingRuleSearchRulesV0alpha1SearchResultHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1Body.
func (ListRecordingRuleSearchRulesV0alpha1Body) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1Body"
}
