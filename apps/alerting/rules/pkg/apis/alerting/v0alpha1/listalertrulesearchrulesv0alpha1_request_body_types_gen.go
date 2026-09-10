// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Exactly one key must be set. The compatibility handler accepts only a
// text/filter leaf or a top-level "and" of those leaves.
type ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode struct {
	And    []ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode `json:"and,omitempty"`
	Or     []ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode `json:"or,omitempty"`
	Not    *ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode  `json:"not,omitempty"`
	Text   *ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf   `json:"text,omitempty"`
	Filter *ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf `json:"filter,omitempty"`
	Range  *ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf  `json:"range,omitempty"`
	Exists *ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf `json:"exists,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode() *ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode"
}

// Omitted fields default to title. All whitespace-separated terms must match
// in any order; punctuation and short-term matching are backend-defined.
type ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf struct {
	Value  string   `json:"value"`
	Fields []string `json:"fields,omitempty"`
	// boost is a future per-leaf score multiplier. Setting it is rejected.
	Boost *float64 `json:"boost,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf() *ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchTextLeaf"
}

type ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf struct {
	Field    string                                                          `json:"field"`
	Operator ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator `json:"operator"`
	Values   []string                                                        `json:"values"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf() *ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf{
		Values: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeaf"
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
type ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf struct {
	Field string   `json:"field"`
	Gt    *float64 `json:"gt,omitempty"`
	Gte   *float64 `json:"gte,omitempty"`
	Lt    *float64 `json:"lt,omitempty"`
	Lte   *float64 `json:"lte,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf() *ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchRangeLeaf"
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
type ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf struct {
	Field string `json:"field"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf() *ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchExistsLeaf"
}

// Selects metadata.labels, not alerting labels, and is ANDed with where.
// Filter alerting labels through the indexed "labels" field instead.
type ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector struct {
	MatchLabels      map[string]string                                                       `json:"matchLabels,omitempty"`
	MatchExpressions []ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement `json:"matchExpressions,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector() *ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector"
}

// Only In and NotIn are accepted by the compatibility handler.
type ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement struct {
	Key      string                                                                        `json:"key"`
	Operator ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator `json:"operator"`
	Values   []string                                                                      `json:"values,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement() *ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirement"
}

// Defaults to ascending; only scalar fields with the sort capability are valid.
type ListAlertRuleSearchRulesV0alpha1RequestSearchSortField struct {
	Field     string                                                           `json:"field"`
	Direction *ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection `json:"direction,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestSearchSortField creates a new ListAlertRuleSearchRulesV0alpha1RequestSearchSortField object.
func NewListAlertRuleSearchRulesV0alpha1RequestSearchSortField() *ListAlertRuleSearchRulesV0alpha1RequestSearchSortField {
	return &ListAlertRuleSearchRulesV0alpha1RequestSearchSortField{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchSortField.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchSortField"
}

type ListAlertRuleSearchRulesV0alpha1RequestBody struct {
	ApiVersion *string `json:"apiVersion,omitempty"`
	Kind       *string `json:"kind,omitempty"`
	// Omitted where matches all authorised rules satisfying labelSelector.
	Where         *ListAlertRuleSearchRulesV0alpha1RequestSearchWhereNode     `json:"where,omitempty"`
	LabelSelector *ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelector `json:"labelSelector,omitempty"`
	Sort          []ListAlertRuleSearchRulesV0alpha1RequestSearchSortField    `json:"sort,omitempty"`
	Fields        []string                                                    `json:"fields,omitempty"`
	Facets        []string                                                    `json:"facets,omitempty"`
	// Per-facet term limit. Zero uses the default; larger values are clamped.
	FacetLimit *int64 `json:"facetLimit,omitempty"`
	// Page size. Zero uses the default; larger values are clamped.
	Limit *int64 `json:"limit,omitempty"`
	// Opaque token from the previous page.
	Continue *string `json:"continue,omitempty"`
}

// NewListAlertRuleSearchRulesV0alpha1RequestBody creates a new ListAlertRuleSearchRulesV0alpha1RequestBody object.
func NewListAlertRuleSearchRulesV0alpha1RequestBody() *ListAlertRuleSearchRulesV0alpha1RequestBody {
	return &ListAlertRuleSearchRulesV0alpha1RequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestBody.
func (ListAlertRuleSearchRulesV0alpha1RequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestBody"
}

type ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator string

const (
	ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorIn    ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "In"
	ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorNotIn ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "NotIn"
	ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorAll   ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator = "All"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperator"
}

type ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator string

const (
	ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorIn           ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "In"
	ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorNotIn        ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "NotIn"
	ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorExists       ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "Exists"
	ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperatorDoesNotExist ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator = "DoesNotExist"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchLabelSelectorRequirementOperator"
}

type ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection string

const (
	ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirectionAsc  ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection = "asc"
	ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirectionDesc ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection = "desc"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection.
func (ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchRulesV0alpha1RequestSearchSortFieldDirection"
}
