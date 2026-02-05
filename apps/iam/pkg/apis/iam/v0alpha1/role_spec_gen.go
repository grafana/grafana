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

// +k8s:openapi-gen=true
type RolespecRoleref struct {
	// Kind of role being referenced (for now only GlobalRole is supported)
	Kind string `json:"kind"`
	// Name of the role being referenced
	Name string `json:"name"`
}

// NewRolespecRoleref creates a new RolespecRoleref object.
func NewRolespecRoleref() *RolespecRoleref {
	return &RolespecRoleref{}
}

// +k8s:openapi-gen=true
type RoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	// All permissions for this role
	Permissions []RolespecPermission `json:"permissions"`
	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only
	PermissionsOmitted *[]RolespecPermission `json:"permissionsOmitted,omitempty"`
	// Roles to take permissions from (for now the list should be of size 1)
	RoleRefs *[]RolespecRoleref `json:"roleRefs,omitempty"`
}

// NewRoleSpec creates a new RoleSpec object.
func NewRoleSpec() *RoleSpec {
	return &RoleSpec{
		Permissions: []RolespecPermission{},
	}
}
