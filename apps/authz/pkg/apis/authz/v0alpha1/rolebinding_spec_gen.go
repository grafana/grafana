// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RoleBindingspecSubject struct {
	// kind of the identity getting the permission
	Kind RoleBindingSpecSubjectKind `json:"kind"`
	// uid of the resource (e.g: "fold1")
	Name string `json:"name"`
}

// NewRoleBindingspecSubject creates a new RoleBindingspecSubject object.
func NewRoleBindingspecSubject() *RoleBindingspecSubject {
	return &RoleBindingspecSubject{}
}

// +k8s:openapi-gen=true
type RoleBindingspecRoleRef struct {
	// kind of role
	Kind RoleBindingRole `json:"kind"`
	// uid of the role
	Name string `json:"name"`
}

// NewRoleBindingspecRoleRef creates a new RoleBindingspecRoleRef object.
func NewRoleBindingspecRoleRef() *RoleBindingspecRoleRef {
	return &RoleBindingspecRoleRef{
		Kind: *NewRoleBindingRole(),
	}
}

// +k8s:openapi-gen=true
type RoleBindingRole struct {
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
	Permissions []RoleBindingRolePermission `json:"permissions"`
}

// NewRoleBindingRole creates a new RoleBindingRole object.
func NewRoleBindingRole() *RoleBindingRole {
	return &RoleBindingRole{
		Permissions: []RoleBindingRolePermission{},
	}
}

// +k8s:openapi-gen=true
type RoleBindingPermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"Scope"`
}

// NewRoleBindingPermission creates a new RoleBindingPermission object.
func NewRoleBindingPermission() *RoleBindingPermission {
	return &RoleBindingPermission{}
}

// +k8s:openapi-gen=true
type RoleBindingRolePermission struct {
	// RBAC action (e.g: "dashbaords:read")
	Action string `json:"action"`
	// RBAC scope (e.g: "dashboards:uid:dash1")
	Scope string `json:"Scope"`
}

// NewRoleBindingRolePermission creates a new RoleBindingRolePermission object.
func NewRoleBindingRolePermission() *RoleBindingRolePermission {
	return &RoleBindingRolePermission{}
}

// +k8s:openapi-gen=true
type RoleBindingSpec struct {
	Subjects []RoleBindingspecSubject `json:"subjects"`
	RoleRef  RoleBindingspecRoleRef   `json:"roleRef"`
}

// NewRoleBindingSpec creates a new RoleBindingSpec object.
func NewRoleBindingSpec() *RoleBindingSpec {
	return &RoleBindingSpec{
		Subjects: []RoleBindingspecSubject{},
		RoleRef:  *NewRoleBindingspecRoleRef(),
	}
}

// +k8s:openapi-gen=true
type RoleBindingSpecSubjectKind string

const (
	RoleBindingSpecSubjectKindUser           RoleBindingSpecSubjectKind = "User"
	RoleBindingSpecSubjectKindServiceAccount RoleBindingSpecSubjectKind = "ServiceAccount"
	RoleBindingSpecSubjectKindTeam           RoleBindingSpecSubjectKind = "Team"
	RoleBindingSpecSubjectKindBasicRole      RoleBindingSpecSubjectKind = "BasicRole"
)
