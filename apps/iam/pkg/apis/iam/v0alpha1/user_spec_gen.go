// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserExternalAuthInfo struct {
	Module      string  `json:"module"`
	AuthIDHash  string  `json:"authIDHash"`
	ExternalUID *string `json:"externalUID,omitempty"`
}

// NewUserExternalAuthInfo creates a new UserExternalAuthInfo object.
func NewUserExternalAuthInfo() *UserExternalAuthInfo {
	return &UserExternalAuthInfo{}
}

// OpenAPIModelName returns the OpenAPI model name for UserExternalAuthInfo.
func (UserExternalAuthInfo) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserExternalAuthInfo"
}

// +k8s:openapi-gen=true
type UserSpec struct {
	Disabled         bool                   `json:"disabled"`
	Email            string                 `json:"email"`
	EmailVerified    bool                   `json:"emailVerified"`
	GrafanaAdmin     bool                   `json:"grafanaAdmin"`
	Login            string                 `json:"login"`
	Title            string                 `json:"title"`
	Provisioned      bool                   `json:"provisioned"`
	Role             string                 `json:"role"`
	ExternalAuthInfo []UserExternalAuthInfo `json:"externalAuthInfo,omitempty"`
}

// NewUserSpec creates a new UserSpec object.
func NewUserSpec() *UserSpec {
	return &UserSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for UserSpec.
func (UserSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserSpec"
}
