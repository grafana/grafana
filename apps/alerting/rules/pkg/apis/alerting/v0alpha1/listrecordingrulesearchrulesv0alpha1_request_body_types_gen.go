// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Exactly one key must be set. The compatibility handler accepts only a
// text/filter leaf or a top-level "and" of those leaves.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode struct {
	And    []ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode `json:"and,omitempty"`
	Or     []ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode `json:"or,omitempty"`
	Not    *ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode  `json:"not,omitempty"`
	Text   *ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf   `json:"text,omitempty"`
	Filter *ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf `json:"filter,omitempty"`
	Range  *ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf  `json:"range,omitempty"`
	Exists *ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf `json:"exists,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode() *ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode"
}

// Omitted fields default to title. All whitespace-separated terms must match
// in any order; punctuation and short-term matching are backend-defined.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf struct {
	Value  string   `json:"value"`
	Fields []string `json:"fields,omitempty"`
	// boost is a future per-leaf score multiplier. Setting it is rejected.
	Boost *float64 `json:"boost,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf() *ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchTextLeaf"
}

type ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf struct {
	Field    string                                                              `json:"field"`
	Operator ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator `json:"operator"`
	Values   []string                                                            `json:"values"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf() *ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf{
		Values: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeaf"
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf struct {
	Field string   `json:"field"`
	Gt    *float64 `json:"gt,omitempty"`
	Gte   *float64 `json:"gte,omitempty"`
	Lt    *float64 `json:"lt,omitempty"`
	Lte   *float64 `json:"lte,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf() *ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchRangeLeaf"
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf struct {
	Field string `json:"field"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf() *ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchExistsLeaf"
}

// Selects metadata.labels, not alerting labels, and is ANDed with where.
// Filter alerting labels through the indexed "labels" field instead.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector struct {
	MatchLabels      map[string]string                                                           `json:"matchLabels,omitempty"`
	MatchExpressions []ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement `json:"matchExpressions,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector() *ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector"
}

// Only In and NotIn are accepted by the compatibility handler.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement struct {
	Key      string                                                                            `json:"key"`
	Operator ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator `json:"operator"`
	Values   []string                                                                          `json:"values,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement() *ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement"
}

// Defaults to ascending; only scalar fields with the sort capability are valid.
type ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField struct {
	Field     string                                                               `json:"field"`
	Direction *ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection `json:"direction,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestSearchSortField creates a new ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField object.
func NewListRecordingRuleSearchRulesV0alpha1RequestSearchSortField() *ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField {
	return &ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField"
}

type ListRecordingRuleSearchRulesV0alpha1RequestBody struct {
	ApiVersion *string `json:"apiVersion,omitempty"`
	Kind       *string `json:"kind,omitempty"`
	// Omitted where matches all authorised rules satisfying labelSelector.
	Where         *ListRecordingRuleSearchRulesV0alpha1RequestSearchWhereNode     `json:"where,omitempty"`
	LabelSelector *ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelector `json:"labelSelector,omitempty"`
	Sort          []ListRecordingRuleSearchRulesV0alpha1RequestSearchSortField    `json:"sort,omitempty"`
	Fields        []string                                                        `json:"fields,omitempty"`
	Facets        []string                                                        `json:"facets,omitempty"`
	// Per-facet term limit. Zero uses the default; larger values are clamped.
	FacetLimit *int64 `json:"facetLimit,omitempty"`
	// Page size. Zero uses the default; larger values are clamped.
	Limit *int64 `json:"limit,omitempty"`
	// Opaque token from the previous page.
	Continue *string `json:"continue,omitempty"`
}

// NewListRecordingRuleSearchRulesV0alpha1RequestBody creates a new ListRecordingRuleSearchRulesV0alpha1RequestBody object.
func NewListRecordingRuleSearchRulesV0alpha1RequestBody() *ListRecordingRuleSearchRulesV0alpha1RequestBody {
	return &ListRecordingRuleSearchRulesV0alpha1RequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestBody.
func (ListRecordingRuleSearchRulesV0alpha1RequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestBody"
}

type ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator string

const (
	ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorIn    ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "In"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorNotIn ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "NotIn"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorAll   ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "All"
)

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator"
}

type ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator string

const (
	ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorIn           ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "In"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorNotIn        ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "NotIn"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorExists       ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "Exists"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorDoesNotExist ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "DoesNotExist"
)

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator"
}

type ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection string

const (
	ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirectionAsc  ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection = "asc"
	ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirectionDesc ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection = "desc"
)

// OpenAPIModelName returns the OpenAPI model name for ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection.
func (ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListRecordingRuleSearchRulesV0alpha1RequestSearchSortFieldDirection"
}
