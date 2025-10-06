// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeScopeFilter struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	// Values is used for operators that require multiple values (e.g. one-of and not-one-of).
	// +listType=atomic
	Values   []string            `json:"values"`
	Operator ScopeFilterOperator `json:"operator"`
}

// NewScopeScopeFilter creates a new ScopeScopeFilter object.
func NewScopeScopeFilter() *ScopeScopeFilter {
	return &ScopeScopeFilter{
		Values: []string{},
	}
}

// +k8s:openapi-gen=true
type ScopeFilterOperator string

const (
	ScopeFilterOperatorEquals        ScopeFilterOperator = "equals"
	ScopeFilterOperatorNotEquals     ScopeFilterOperator = "not-equals"
	ScopeFilterOperatorRegexMatch    ScopeFilterOperator = "regex-match"
	ScopeFilterOperatorRegexNotMatch ScopeFilterOperator = "regex-not-match"
	ScopeFilterOperatorOneOf         ScopeFilterOperator = "one-of"
	ScopeFilterOperatorNotOneOf      ScopeFilterOperator = "not-one-of"
)

// +k8s:openapi-gen=true
type ScopeSpec struct {
	Title string `json:"title"`
	// Provides a default path for the scope. This refers to a list of nodes in the selector. This is used to display the title next to the selected scope and expand the selector to the proper path.
	// This will override whichever is selected from in the selector.
	// The path is a list of node ids, starting at the direct parent of the selected node towards the root.
	// +listType=atomic
	DefaultPath []string `json:"defaultPath,omitempty"`
	// +listType=atomic
	Filters []ScopeScopeFilter `json:"filters,omitempty"`
}

// NewScopeSpec creates a new ScopeSpec object.
func NewScopeSpec() *ScopeSpec {
	return &ScopeSpec{}
}
