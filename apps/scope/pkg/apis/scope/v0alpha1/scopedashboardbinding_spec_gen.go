// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ScopeDashboardBindingSpec struct {
	Dashboard string `json:"dashboard"`
	Scope     string `json:"scope"`
}

// NewScopeDashboardBindingSpec creates a new ScopeDashboardBindingSpec object.
func NewScopeDashboardBindingSpec() *ScopeDashboardBindingSpec {
	return &ScopeDashboardBindingSpec{}
}
