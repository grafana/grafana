// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeNodeSpec struct {
	// +optional
	ParentName         *string               `json:"parentName,omitempty"`
	NodeType           ScopeNodeSpecNodeType `json:"nodeType"`
	Title              string                `json:"title"`
	Description        *string               `json:"description,omitempty"`
	DisableMultiSelect bool                  `json:"disableMultiSelect"`
	// scope (later more things)
	LinkType *string `json:"linkType,omitempty"`
	// ?? should this be a slice of links
	// the k8s name
	LinkId *string `json:"linkId,omitempty"`
}

// NewScopeNodeSpec creates a new ScopeNodeSpec object.
func NewScopeNodeSpec() *ScopeNodeSpec {
	return &ScopeNodeSpec{
		LinkType: (func(input string) *string { return &input })("scope"),
	}
}

// +k8s:openapi-gen=true
type ScopeNodeSpecNodeType string

const (
	ScopeNodeSpecNodeTypeContainer ScopeNodeSpecNodeType = "container"
	ScopeNodeSpecNodeTypeLeaf      ScopeNodeSpecNodeType = "leaf"
)
