// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeNavigationSpec struct {
	Url   string `json:"url"`
	Scope string `json:"scope"`
}

// NewScopeNavigationSpec creates a new ScopeNavigationSpec object.
func NewScopeNavigationSpec() *ScopeNavigationSpec {
	return &ScopeNavigationSpec{}
}
