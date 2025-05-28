// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RoleBindingspecSubject struct {
	// kind of the identity getting the permission
	Kind RoleBindingSpecSubjectKind `json:"kind"`
	// uid of the identity
	Name string `json:"name"`
}

// NewRoleBindingspecSubject creates a new RoleBindingspecSubject object.
func NewRoleBindingspecSubject() *RoleBindingspecSubject {
	return &RoleBindingspecSubject{}
}

// +k8s:openapi-gen=true
type RoleBindingspecRoleRef struct {
	// kind of role
	Kind RoleBindingSpecRoleRefKind `json:"kind"`
	// uid of the role
	Name string `json:"name"`
}

// NewRoleBindingspecRoleRef creates a new RoleBindingspecRoleRef object.
func NewRoleBindingspecRoleRef() *RoleBindingspecRoleRef {
	return &RoleBindingspecRoleRef{}
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

// +k8s:openapi-gen=true
type RoleBindingSpecRoleRefKind string

const (
	RoleBindingSpecRoleRefKindRole       RoleBindingSpecRoleRefKind = "Role"
	RoleBindingSpecRoleRefKindCoreRole   RoleBindingSpecRoleRefKind = "CoreRole"
	RoleBindingSpecRoleRefKindGlobalRole RoleBindingSpecRoleRefKind = "GlobalRole"
)
