// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// #SearchWhereNode is a single node of the where query tree. Exactly one key
// must be set, and the set key names the node's type. Combinators (and/or/not)
// compose other nodes; leaves (text/filter/range/exists) are terminal
// predicates.
//
// Every node type is modelled so the schema is future-proof, but only a narrow
// subset is accepted: a single top-level leaf, or one "and" over text and
// filter leaves. Everything else is rejected. or, not, range and exists are
// sketched for future versions and always rejected today.
type ListAlertRuleSearchV0alpha1RequestSearchWhereNode struct {
	// Combinators.
	And []ListAlertRuleSearchV0alpha1RequestSearchWhereNode `json:"and,omitempty"`
	Or  []ListAlertRuleSearchV0alpha1RequestSearchWhereNode `json:"or,omitempty"`
	Not *ListAlertRuleSearchV0alpha1RequestSearchWhereNode  `json:"not,omitempty"`
	// Leaves.
	Text   *ListAlertRuleSearchV0alpha1RequestSearchTextLeaf   `json:"text,omitempty"`
	Filter *ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf `json:"filter,omitempty"`
	Range  *ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf  `json:"range,omitempty"`
	Exists *ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf `json:"exists,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchWhereNode creates a new ListAlertRuleSearchV0alpha1RequestSearchWhereNode object.
func NewListAlertRuleSearchV0alpha1RequestSearchWhereNode() *ListAlertRuleSearchV0alpha1RequestSearchWhereNode {
	return &ListAlertRuleSearchV0alpha1RequestSearchWhereNode{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchWhereNode.
func (ListAlertRuleSearchV0alpha1RequestSearchWhereNode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchWhereNode"
}

// #SearchTextLeaf is a free-text predicate against one or more text-capable
// fields. When fields is omitted, the kind's default text field set is used
// (today: title). A match requires every whitespace-separated term of value to
// appear in the field, in any order. How very short terms, punctuation, and
// common words are matched is backend-defined and may change.
type ListAlertRuleSearchV0alpha1RequestSearchTextLeaf struct {
	Value  string   `json:"value"`
	Fields []string `json:"fields,omitempty"`
	// boost is a future per-leaf score multiplier. Setting it is rejected.
	Boost *float64 `json:"boost,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchTextLeaf creates a new ListAlertRuleSearchV0alpha1RequestSearchTextLeaf object.
func NewListAlertRuleSearchV0alpha1RequestSearchTextLeaf() *ListAlertRuleSearchV0alpha1RequestSearchTextLeaf {
	return &ListAlertRuleSearchV0alpha1RequestSearchTextLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchTextLeaf.
func (ListAlertRuleSearchV0alpha1RequestSearchTextLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchTextLeaf"
}

// #SearchFilterLeaf matches a single field against a set of values.
type ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf struct {
	Field    string                                                     `json:"field"`
	Operator ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator `json:"operator"`
	Values   []string                                                   `json:"values"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchFilterLeaf creates a new ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf object.
func NewListAlertRuleSearchV0alpha1RequestSearchFilterLeaf() *ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf {
	return &ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf{
		Values: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf.
func (ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchFilterLeaf"
}

// #SearchRangeLeaf is a future numeric/date range predicate. Modelled for
// schema stability; always rejected today.
type ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf struct {
	Field string   `json:"field"`
	Gt    *float64 `json:"gt,omitempty"`
	Gte   *float64 `json:"gte,omitempty"`
	Lt    *float64 `json:"lt,omitempty"`
	Lte   *float64 `json:"lte,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchRangeLeaf creates a new ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf object.
func NewListAlertRuleSearchV0alpha1RequestSearchRangeLeaf() *ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf {
	return &ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf.
func (ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchRangeLeaf"
}

// #SearchExistsLeaf is a future field-existence predicate. Modelled for schema
// stability; always rejected today.
type ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf struct {
	Field string `json:"field"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchExistsLeaf creates a new ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf object.
func NewListAlertRuleSearchV0alpha1RequestSearchExistsLeaf() *ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf {
	return &ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf.
func (ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchExistsLeaf"
}

// #SearchLabelSelector filters on the resource's metadata.labels, mirroring
// metav1.LabelSelector. It is ANDed with where. Note this selects resource
// metadata labels, not the rules' own alerting labels: those are filtered
// through a where filter leaf on the indexed "labels" field.
type ListAlertRuleSearchV0alpha1RequestSearchLabelSelector struct {
	MatchLabels      map[string]string                                                  `json:"matchLabels,omitempty"`
	MatchExpressions []ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement `json:"matchExpressions,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchLabelSelector creates a new ListAlertRuleSearchV0alpha1RequestSearchLabelSelector object.
func NewListAlertRuleSearchV0alpha1RequestSearchLabelSelector() *ListAlertRuleSearchV0alpha1RequestSearchLabelSelector {
	return &ListAlertRuleSearchV0alpha1RequestSearchLabelSelector{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchLabelSelector.
func (ListAlertRuleSearchV0alpha1RequestSearchLabelSelector) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchLabelSelector"
}

// #SearchLabelSelectorRequirement is one metadata label requirement, mirroring
// metav1.LabelSelectorRequirement. Only In and NotIn are accepted; Exists and
// DoesNotExist are modelled for schema stability and rejected.
type ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement struct {
	Key      string                                                                   `json:"key"`
	Operator ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator `json:"operator"`
	Values   []string                                                                 `json:"values,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement creates a new ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement object.
func NewListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement() *ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement {
	return &ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement.
func (ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirement"
}

// #SearchSortField names a field to sort by and a direction, defaulting to
// ascending. Only fields declaring the sort capability may be named, and only
// scalar ones: sorting on a list of values has no defined meaning.
type ListAlertRuleSearchV0alpha1RequestSearchSortField struct {
	Field     string                                                      `json:"field"`
	Direction *ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection `json:"direction,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestSearchSortField creates a new ListAlertRuleSearchV0alpha1RequestSearchSortField object.
func NewListAlertRuleSearchV0alpha1RequestSearchSortField() *ListAlertRuleSearchV0alpha1RequestSearchSortField {
	return &ListAlertRuleSearchV0alpha1RequestSearchSortField{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchSortField.
func (ListAlertRuleSearchV0alpha1RequestSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchSortField"
}

type ListAlertRuleSearchV0alpha1RequestBody struct {
	ApiVersion *string `json:"apiVersion,omitempty"`
	Kind       *string `json:"kind,omitempty"`
	// where is the search predicate tree. Omitting it matches every rule of the
	// kind, subject to labelSelector and per-rule authorisation.
	Where         *ListAlertRuleSearchV0alpha1RequestSearchWhereNode     `json:"where,omitempty"`
	LabelSelector *ListAlertRuleSearchV0alpha1RequestSearchLabelSelector `json:"labelSelector,omitempty"`
	Sort          []ListAlertRuleSearchV0alpha1RequestSearchSortField    `json:"sort,omitempty"`
	Fields        []string                                               `json:"fields,omitempty"`
	Facets        []string                                               `json:"facets,omitempty"`
	// facetLimit caps the number of terms returned per facet, for every entry in
	// facets. Zero uses the server default; larger values are clamped.
	FacetLimit *int64 `json:"facetLimit,omitempty"`
	// limit is the page size. Zero uses the default; larger values are clamped.
	Limit *int64 `json:"limit,omitempty"`
	// continue is an opaque paging token from a previous page.
	Continue *string `json:"continue,omitempty"`
}

// NewListAlertRuleSearchV0alpha1RequestBody creates a new ListAlertRuleSearchV0alpha1RequestBody object.
func NewListAlertRuleSearchV0alpha1RequestBody() *ListAlertRuleSearchV0alpha1RequestBody {
	return &ListAlertRuleSearchV0alpha1RequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestBody.
func (ListAlertRuleSearchV0alpha1RequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestBody"
}

type ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator string

const (
	ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperatorIn    ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator = "In"
	ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperatorNotIn ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator = "NotIn"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator.
func (ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchFilterLeafOperator"
}

type ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator string

const (
	ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperatorIn           ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator = "In"
	ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperatorNotIn        ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator = "NotIn"
	ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperatorExists       ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator = "Exists"
	ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperatorDoesNotExist ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator = "DoesNotExist"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator.
func (ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchLabelSelectorRequirementOperator"
}

type ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection string

const (
	ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirectionAsc  ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection = "asc"
	ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirectionDesc ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection = "desc"
)

// OpenAPIModelName returns the OpenAPI model name for ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection.
func (ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ListAlertRuleSearchV0alpha1RequestSearchSortFieldDirection"
}
