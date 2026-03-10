// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CoreRolespecPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"scope"`
}

// NewCoreRolespecPermission creates a new CoreRolespecPermission object.
func NewCoreRolespecPermission() *CoreRolespecPermission {
	return &CoreRolespecPermission{}
}

// OpenAPIModelName returns the OpenAPI model name for CoreRolespecPermission.
func (CoreRolespecPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CoreRolespecPermission"
}

// +k8s:openapi-gen=true
type CoreRoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// Permissions for this role
	Permissions []CoreRolespecPermission `json:"permissions,omitempty"`
}

// NewCoreRoleSpec creates a new CoreRoleSpec object.
func NewCoreRoleSpec() *CoreRoleSpec {
	return &CoreRoleSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for CoreRoleSpec.
func (CoreRoleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CoreRoleSpec"
}
