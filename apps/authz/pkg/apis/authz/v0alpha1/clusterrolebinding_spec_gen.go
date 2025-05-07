// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterRoleBindingspecSubject struct {
	// kind of the identity getting the permission
	Kind ClusterRoleBindingSpecSubjectKind `json:"kind"`
	// uid of the identity
	Name string `json:"name"`
}

// NewClusterRoleBindingspecSubject creates a new ClusterRoleBindingspecSubject object.
func NewClusterRoleBindingspecSubject() *ClusterRoleBindingspecSubject {
	return &ClusterRoleBindingspecSubject{}
}

// +k8s:openapi-gen=true
type ClusterRoleBindingspecRoleRef struct {
	// kind of role
	Kind ClusterRoleBindingSpecRoleRefKind `json:"kind"`
	// uid of the role
	Name string `json:"name"`
}

// NewClusterRoleBindingspecRoleRef creates a new ClusterRoleBindingspecRoleRef object.
func NewClusterRoleBindingspecRoleRef() *ClusterRoleBindingspecRoleRef {
	return &ClusterRoleBindingspecRoleRef{}
}

// +k8s:openapi-gen=true
type ClusterRoleBindingSpec struct {
	Subjects []ClusterRoleBindingspecSubject `json:"subjects"`
	RoleRef  ClusterRoleBindingspecRoleRef   `json:"roleRef"`
}

// NewClusterRoleBindingSpec creates a new ClusterRoleBindingSpec object.
func NewClusterRoleBindingSpec() *ClusterRoleBindingSpec {
	return &ClusterRoleBindingSpec{
		Subjects: []ClusterRoleBindingspecSubject{},
		RoleRef:  *NewClusterRoleBindingspecRoleRef(),
	}
}

// +k8s:openapi-gen=true
type ClusterRoleBindingSpecSubjectKind string

const (
	ClusterRoleBindingSpecSubjectKindUser           ClusterRoleBindingSpecSubjectKind = "User"
	ClusterRoleBindingSpecSubjectKindServiceAccount ClusterRoleBindingSpecSubjectKind = "ServiceAccount"
	ClusterRoleBindingSpecSubjectKindTeam           ClusterRoleBindingSpecSubjectKind = "Team"
	ClusterRoleBindingSpecSubjectKindBasicRole      ClusterRoleBindingSpecSubjectKind = "BasicRole"
)

// +k8s:openapi-gen=true
type ClusterRoleBindingSpecRoleRefKind string

const (
	ClusterRoleBindingSpecRoleRefKindRole        ClusterRoleBindingSpecRoleRefKind = "Role"
	ClusterRoleBindingSpecRoleRefKindCoreRole    ClusterRoleBindingSpecRoleRefKind = "CoreRole"
	ClusterRoleBindingSpecRoleRefKindClusterRole ClusterRoleBindingSpecRoleRefKind = "ClusterRole"
)
