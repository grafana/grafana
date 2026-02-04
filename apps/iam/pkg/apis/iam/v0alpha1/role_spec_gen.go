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
type RoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Group       string `json:"group"`
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	// Permissions for custom roles
	Permissions []RolespecPermission `json:"permissions"`
	// Permissions that exist in actual role but NOT in seed (added/excess permissions) - used for basic roles
	PermissionsAdded *[]RolespecPermission `json:"permissionsAdded,omitempty"`
	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles
	PermissionsOmitted *[]RolespecPermission `json:"permissionsOmitted,omitempty"`
}

// NewRoleSpec creates a new RoleSpec object.
func NewRoleSpec() *RoleSpec {
	return &RoleSpec{
		Permissions: []RolespecPermission{},
	}
}
