// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalRoleBindingspecSubject struct {
	// kind of the identity getting the permission
	Kind GlobalRoleBindingSpecSubjectKind `json:"kind"`
	// uid of the identity
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// NewGlobalRoleBindingspecSubject creates a new GlobalRoleBindingspecSubject object.
func NewGlobalRoleBindingspecSubject() *GlobalRoleBindingspecSubject {
	return &GlobalRoleBindingspecSubject{}
}

// +k8s:openapi-gen=true
type GlobalRoleBindingspecRoleRef struct {
	// kind of role
	Kind GlobalRoleBindingSpecRoleRefKind `json:"kind"`
	// uid of the role
	Name string `json:"name"`
}

// NewGlobalRoleBindingspecRoleRef creates a new GlobalRoleBindingspecRoleRef object.
func NewGlobalRoleBindingspecRoleRef() *GlobalRoleBindingspecRoleRef {
	return &GlobalRoleBindingspecRoleRef{}
}

// +k8s:openapi-gen=true
type GlobalRoleBindingSpec struct {
	Subject GlobalRoleBindingspecSubject   `json:"subject"`
	RoleRef []GlobalRoleBindingspecRoleRef `json:"roleRef"`
}

// NewGlobalRoleBindingSpec creates a new GlobalRoleBindingSpec object.
func NewGlobalRoleBindingSpec() *GlobalRoleBindingSpec {
	return &GlobalRoleBindingSpec{
		Subject: *NewGlobalRoleBindingspecSubject(),
		RoleRef: []GlobalRoleBindingspecRoleRef{},
	}
}

// +k8s:openapi-gen=true
type GlobalRoleBindingSpecSubjectKind string

const (
	GlobalRoleBindingSpecSubjectKindUser           GlobalRoleBindingSpecSubjectKind = "User"
	GlobalRoleBindingSpecSubjectKindServiceAccount GlobalRoleBindingSpecSubjectKind = "ServiceAccount"
	GlobalRoleBindingSpecSubjectKindTeam           GlobalRoleBindingSpecSubjectKind = "Team"
	GlobalRoleBindingSpecSubjectKindBasicRole      GlobalRoleBindingSpecSubjectKind = "BasicRole"
)

// +k8s:openapi-gen=true
type GlobalRoleBindingSpecRoleRefKind string

const (
	GlobalRoleBindingSpecRoleRefKindCoreRole   GlobalRoleBindingSpecRoleRefKind = "CoreRole"
	GlobalRoleBindingSpecRoleRefKindGlobalRole GlobalRoleBindingSpecRoleRefKind = "GlobalRole"
)
