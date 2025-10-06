// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FindScopeNodeChildrenResultsScopeNode struct {
	Kind       string                                              `json:"kind"`
	PluralName string                                              `json:"pluralName"`
	Schema     FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema `json:"schema"`
}

// NewFindScopeNodeChildrenResultsScopeNode creates a new FindScopeNodeChildrenResultsScopeNode object.
func NewFindScopeNodeChildrenResultsScopeNode() *FindScopeNodeChildrenResultsScopeNode {
	return &FindScopeNodeChildrenResultsScopeNode{
		Kind:       "ScopeNode",
		PluralName: "ScopeNodes",
		Schema:     *NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema(),
	}
}

// +k8s:openapi-gen=true
type FindScopeNodeChildrenResultsSpec struct {
	Items []FindScopeNodeChildrenResultsScopeNode `json:"items,omitempty"`
}

// NewFindScopeNodeChildrenResultsSpec creates a new FindScopeNodeChildrenResultsSpec object.
func NewFindScopeNodeChildrenResultsSpec() *FindScopeNodeChildrenResultsSpec {
	return &FindScopeNodeChildrenResultsSpec{}
}

// +k8s:openapi-gen=true
type FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec struct {
	// +optional
	ParentName         *string                                                         `json:"parentName,omitempty"`
	NodeType           FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeType `json:"nodeType"`
	Title              string                                                          `json:"title"`
	Description        *string                                                         `json:"description,omitempty"`
	DisableMultiSelect bool                                                            `json:"disableMultiSelect"`
	// scope (later more things)
	LinkType *string `json:"linkType,omitempty"`
	// ?? should this be a slice of links
	// the k8s name
	LinkId *string `json:"linkId,omitempty"`
}

// NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec creates a new FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec object.
func NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec() *FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec {
	return &FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec{
		LinkType: (func(input string) *string { return &input })("scope"),
	}
}

// +k8s:openapi-gen=true
type FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema struct {
	Spec FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec `json:"spec"`
}

// NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema creates a new FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema object.
func NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema() *FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema {
	return &FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchema{
		Spec: *NewFindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpec(),
	}
}

// +k8s:openapi-gen=true
type FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeType string

const (
	FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeTypeContainer FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeType = "container"
	FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeTypeLeaf      FindScopeNodeChildrenResultsV0alpha1ScopeNodeSchemaSpecNodeType = "leaf"
)
