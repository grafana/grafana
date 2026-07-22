// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// #SearchWhereNode is a single node of the where query tree. A node has
// exactly one key naming its type. v1 supports a top-level "and" combinator
// plus the "text" and "filter" leaves; "or"/"not"/nesting and the "range"/
// "exists" leaves are future, additive extensions.
type CreateSearchRulesRequestSearchWhereNode struct {
	And    []CreateSearchRulesRequestSearchWhereNode `json:"and,omitempty"`
	Text   *CreateSearchRulesRequestSearchTextLeaf   `json:"text,omitempty"`
	Filter *CreateSearchRulesRequestSearchFilterLeaf `json:"filter,omitempty"`
}

// NewCreateSearchRulesRequestSearchWhereNode creates a new CreateSearchRulesRequestSearchWhereNode object.
func NewCreateSearchRulesRequestSearchWhereNode() *CreateSearchRulesRequestSearchWhereNode {
	return &CreateSearchRulesRequestSearchWhereNode{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRequestSearchWhereNode.
func (CreateSearchRulesRequestSearchWhereNode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRequestSearchWhereNode"
}

// #SearchTextLeaf is a free-text search across one or more text-capable
// fields. When fields is omitted, the kind's default text field set is used.
type CreateSearchRulesRequestSearchTextLeaf struct {
	Value  string   `json:"value"`
	Fields []string `json:"fields,omitempty"`
}

// NewCreateSearchRulesRequestSearchTextLeaf creates a new CreateSearchRulesRequestSearchTextLeaf object.
func NewCreateSearchRulesRequestSearchTextLeaf() *CreateSearchRulesRequestSearchTextLeaf {
	return &CreateSearchRulesRequestSearchTextLeaf{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRequestSearchTextLeaf.
func (CreateSearchRulesRequestSearchTextLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRequestSearchTextLeaf"
}

// #SearchFilterLeaf matches a single field against a set of values.
type CreateSearchRulesRequestSearchFilterLeaf struct {
	Field    string                                           `json:"field"`
	Operator CreateSearchRulesRequestSearchFilterLeafOperator `json:"operator"`
	Values   []string                                         `json:"values"`
}

// NewCreateSearchRulesRequestSearchFilterLeaf creates a new CreateSearchRulesRequestSearchFilterLeaf object.
func NewCreateSearchRulesRequestSearchFilterLeaf() *CreateSearchRulesRequestSearchFilterLeaf {
	return &CreateSearchRulesRequestSearchFilterLeaf{
		Values: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRequestSearchFilterLeaf.
func (CreateSearchRulesRequestSearchFilterLeaf) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRequestSearchFilterLeaf"
}

// #SearchSortField selects a result ordering. A leading "-" denotes
// descending. Each field must be declared sortable in the kind's manifest.
type CreateSearchRulesRequestSearchSortField string

type CreateSearchRulesRequestBody struct {
	Where         *CreateSearchRulesRequestSearchWhereNode  `json:"where,omitempty"`
	LabelSelector *string                                   `json:"labelSelector,omitempty"`
	Sort          []CreateSearchRulesRequestSearchSortField `json:"sort,omitempty"`
	Fields        []string                                  `json:"fields,omitempty"`
	Facets        []string                                  `json:"facets,omitempty"`
	Limit         *int64                                    `json:"limit,omitempty"`
	Continue      *string                                   `json:"continue,omitempty"`
}

// NewCreateSearchRulesRequestBody creates a new CreateSearchRulesRequestBody object.
func NewCreateSearchRulesRequestBody() *CreateSearchRulesRequestBody {
	return &CreateSearchRulesRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRequestBody.
func (CreateSearchRulesRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRequestBody"
}

type CreateSearchRulesRequestSearchFilterLeafOperator string

const (
	CreateSearchRulesRequestSearchFilterLeafOperatorIn    CreateSearchRulesRequestSearchFilterLeafOperator = "In"
	CreateSearchRulesRequestSearchFilterLeafOperatorNotIn CreateSearchRulesRequestSearchFilterLeafOperator = "NotIn"
)

// OpenAPIModelName returns the OpenAPI model name for CreateSearchRulesRequestSearchFilterLeafOperator.
func (CreateSearchRulesRequestSearchFilterLeafOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.CreateSearchRulesRequestSearchFilterLeafOperator"
}
