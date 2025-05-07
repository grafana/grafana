// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RolespecPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"Scope"`
}

// NewRolespecPermission creates a new RolespecPermission object.
func NewRolespecPermission() *RolespecPermission {
	return &RolespecPermission{}
}

// +k8s:openapi-gen=true
type RoleSpec struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Uid         string `json:"uid"`
	Version     int64  `json:"version"`
	Group       string `json:"group"`
	// TODO:
	// delegatable?: bool
	// hidden?: bool
	// created?
	// updated?
	Permissions []RolespecPermission `json:"permissions"`
}

// NewRoleSpec creates a new RoleSpec object.
func NewRoleSpec() *RoleSpec {
	return &RoleSpec{
		Permissions: []RolespecPermission{},
	}
}
