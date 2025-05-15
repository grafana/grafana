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
	Names string `json:"names"`
	// Display name of the role
	Title string `json:"title"`
	// ToDo should we remove UID given it should be the k8s resource name?
	Uid     string `json:"uid"`
	Version int64  `json:"version"`
	Group   string `json:"group"`
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	Permissions []GlobalRolespecPermission `json:"permissions"`
}

// NewGlobalRoleSpec creates a new GlobalRoleSpec object.
func NewGlobalRoleSpec() *GlobalRoleSpec {
	return &GlobalRoleSpec{
		Permissions: []GlobalRolespecPermission{},
	}
}
