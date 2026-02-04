// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserSpec struct {
	Disabled      bool   `json:"disabled"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
	GrafanaAdmin  bool   `json:"grafanaAdmin"`
	Login         string `json:"login"`
	Title         string `json:"title"`
	Provisioned   bool   `json:"provisioned"`
	Role          string `json:"role"`
}

// NewUserSpec creates a new UserSpec object.
func NewUserSpec() *UserSpec {
	return &UserSpec{}
}
