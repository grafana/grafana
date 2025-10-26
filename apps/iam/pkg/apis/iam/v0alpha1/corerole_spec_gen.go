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
type CoreRoleSpec struct {
	// Display name of the role
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     int64  `json:"version"`
	Group       string `json:"group"`
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	Permissions []CoreRolespecPermission `json:"permissions"`
}

// NewCoreRoleSpec creates a new CoreRoleSpec object.
func NewCoreRoleSpec() *CoreRoleSpec {
	return &CoreRoleSpec{
		Permissions: []CoreRolespecPermission{},
	}
}
