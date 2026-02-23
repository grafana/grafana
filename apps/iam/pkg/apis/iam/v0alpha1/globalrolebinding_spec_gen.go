// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalRoleBindingspecSubject struct {
	// kind of the identity getting the permission
	Kind GlobalRoleBindingSpecSubjectKind `json:"kind"`
	// uid of the identity
	Name string `json:"name"`
}

// NewGlobalRoleBindingspecSubject creates a new GlobalRoleBindingspecSubject object.
func NewGlobalRoleBindingspecSubject() *GlobalRoleBindingspecSubject {
	return &GlobalRoleBindingspecSubject{}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleBindingspecSubject.
func (GlobalRoleBindingspecSubject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleBindingspecSubject"
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

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleBindingspecRoleRef.
func (GlobalRoleBindingspecRoleRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleBindingspecRoleRef"
}

// +k8s:openapi-gen=true
type GlobalRoleBindingSpec struct {
	Subject  GlobalRoleBindingspecSubject   `json:"subject"`
	RoleRefs []GlobalRoleBindingspecRoleRef `json:"roleRefs"`
}

// NewGlobalRoleBindingSpec creates a new GlobalRoleBindingSpec object.
func NewGlobalRoleBindingSpec() *GlobalRoleBindingSpec {
	return &GlobalRoleBindingSpec{
		Subject:  *NewGlobalRoleBindingspecSubject(),
		RoleRefs: []GlobalRoleBindingspecRoleRef{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleBindingSpec.
func (GlobalRoleBindingSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleBindingSpec"
}

// +k8s:openapi-gen=true
type GlobalRoleBindingSpecSubjectKind string

const (
	GlobalRoleBindingSpecSubjectKindUser           GlobalRoleBindingSpecSubjectKind = "User"
	GlobalRoleBindingSpecSubjectKindServiceAccount GlobalRoleBindingSpecSubjectKind = "ServiceAccount"
	GlobalRoleBindingSpecSubjectKindTeam           GlobalRoleBindingSpecSubjectKind = "Team"
	GlobalRoleBindingSpecSubjectKindBasicRole      GlobalRoleBindingSpecSubjectKind = "BasicRole"
)

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleBindingSpecSubjectKind.
func (GlobalRoleBindingSpecSubjectKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleBindingSpecSubjectKind"
}

// +k8s:openapi-gen=true
type GlobalRoleBindingSpecRoleRefKind string

const (
	GlobalRoleBindingSpecRoleRefKindCoreRole   GlobalRoleBindingSpecRoleRefKind = "CoreRole"
	GlobalRoleBindingSpecRoleRefKindGlobalRole GlobalRoleBindingSpecRoleRefKind = "GlobalRole"
)

// OpenAPIModelName returns the OpenAPI model name for GlobalRoleBindingSpecRoleRefKind.
func (GlobalRoleBindingSpecRoleRefKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GlobalRoleBindingSpecRoleRefKind"
}
