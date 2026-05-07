// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RolespecPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"scope"`
}

// NewRolespecPermission creates a new RolespecPermission object.
func NewRolespecPermission() *RolespecPermission {
	return &RolespecPermission{}
}

// OpenAPIModelName returns the OpenAPI model name for RolespecPermission.
func (RolespecPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.RolespecPermission"
}

// +k8s:openapi-gen=true
type RolespecRoleRef struct {
	// Kind of role being referenced (for now only GlobalRole is supported)
	Kind string `json:"kind"`
	// Name of the role being referenced
	Name string `json:"name"`
}

// NewRolespecRoleRef creates a new RolespecRoleRef object.
func NewRolespecRoleRef() *RolespecRoleRef {
	return &RolespecRoleRef{}
}

// OpenAPIModelName returns the OpenAPI model name for RolespecRoleRef.
func (RolespecRoleRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.RolespecRoleRef"
}

// +k8s:openapi-gen=true
type RoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.
	Permissions []RolespecPermission `json:"permissions,omitempty"`
	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only
	PermissionsOmitted []RolespecPermission `json:"permissionsOmitted,omitempty"`
	// Roles to take permissions from (for now the list should be of size 1)
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	RoleRefs []RolespecRoleRef `json:"roleRefs,omitempty"`
}

// NewRoleSpec creates a new RoleSpec object.
func NewRoleSpec() *RoleSpec {
	return &RoleSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for RoleSpec.
func (RoleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.RoleSpec"
}
