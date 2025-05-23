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

// +k8s:openapi-gen=true
type GlobalRoleSpec struct {
	// Display name of the role
	Title       string                     `json:"title"`
	Version     int64                      `json:"version"`
	Group       string                     `json:"group"`
	Permissions []GlobalRolespecPermission `json:"permissions"`
	// Required for authz checks
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	InternalID int64 `json:"internalID"`
}

// NewGlobalRoleSpec creates a new GlobalRoleSpec object.
func NewGlobalRoleSpec() *GlobalRoleSpec {
	return &GlobalRoleSpec{}
}
