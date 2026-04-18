// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalRolespecPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"scope"`
}

// NewGlobalRolespecPermission creates a new GlobalRolespecPermission object.
func NewGlobalRolespecPermission() *GlobalRolespecPermission {
	return &GlobalRolespecPermission{}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalRolespecPermission.
func (GlobalRolespecPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRolespecPermission"
}

// +k8s:openapi-gen=true
type GlobalRoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// Permissions for this role
	Permissions []GlobalRolespecPermission `json:"permissions,omitempty"`
}

// NewGlobalRoleSpec creates a new GlobalRoleSpec object.
func NewGlobalRoleSpec() *GlobalRoleSpec {
	return &GlobalRoleSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleSpec.
func (GlobalRoleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleSpec"
}
