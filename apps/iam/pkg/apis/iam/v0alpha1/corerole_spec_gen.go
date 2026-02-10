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

// +k8s:openapi-gen=true
type CoreRolespecRoleRef struct {
	// Kind of role being referenced (for now only GlobalRole is supported)
	Kind string `json:"kind"`
	// Name of the role being referenced
	Name string `json:"name"`
}

// NewCoreRolespecRoleRef creates a new CoreRolespecRoleRef object.
func NewCoreRolespecRoleRef() *CoreRolespecRoleRef {
	return &CoreRolespecRoleRef{}
}

// +k8s:openapi-gen=true
type CoreRoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.
	Permissions []CoreRolespecPermission `json:"permissions"`
	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only
	PermissionsOmitted []CoreRolespecPermission `json:"permissionsOmitted"`
	// Roles to take permissions from (for now the list should be of size 1)
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	RoleRefs []CoreRolespecRoleRef `json:"roleRefs,omitempty"`
}

// NewCoreRoleSpec creates a new CoreRoleSpec object.
func NewCoreRoleSpec() *CoreRoleSpec {
	return &CoreRoleSpec{
		Permissions:        []CoreRolespecPermission{},
		PermissionsOmitted: []CoreRolespecPermission{},
	}
}
