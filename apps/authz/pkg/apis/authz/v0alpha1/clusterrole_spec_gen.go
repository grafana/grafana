// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterRolespecPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"scope"`
}

// NewClusterRolespecPermission creates a new ClusterRolespecPermission object.
func NewClusterRolespecPermission() *ClusterRolespecPermission {
	return &ClusterRolespecPermission{}
}

// +k8s:openapi-gen=true
type ClusterRoleSpec struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Uid         string `json:"uid"`
	Version     int64  `json:"version"`
	Group       string `json:"group"`
	// TODO:
	// delegatable?: bool
	// created?
	// updated?
	Permissions []ClusterRolespecPermission `json:"permissions"`
}

// NewClusterRoleSpec creates a new ClusterRoleSpec object.
func NewClusterRoleSpec() *ClusterRoleSpec {
	return &ClusterRoleSpec{
		Permissions: []ClusterRolespecPermission{},
	}
}
