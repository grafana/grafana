// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserAuthLabel struct {
	Module      string  `json:"module"`
	AuthID      string  `json:"authID"`
	ExternalUID *string `json:"externalUID,omitempty"`
}

// NewUserAuthLabel creates a new UserAuthLabel object.
func NewUserAuthLabel() *UserAuthLabel {
	return &UserAuthLabel{}
}

// OpenAPIModelName returns the OpenAPI model name for UserAuthLabel.
func (UserAuthLabel) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserAuthLabel"
}

// +k8s:openapi-gen=true
type UserSpec struct {
	Disabled      bool            `json:"disabled"`
	Email         string          `json:"email"`
	EmailVerified bool            `json:"emailVerified"`
	GrafanaAdmin  bool            `json:"grafanaAdmin"`
	Login         string          `json:"login"`
	Title         string          `json:"title"`
	Provisioned   bool            `json:"provisioned"`
	Role          string          `json:"role"`
	AuthLabels    []UserAuthLabel `json:"authLabels,omitempty"`
}

// NewUserSpec creates a new UserSpec object.
func NewUserSpec() *UserSpec {
	return &UserSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for UserSpec.
func (UserSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserSpec"
}
