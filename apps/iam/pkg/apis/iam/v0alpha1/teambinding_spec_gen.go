// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamBindingspecSubject struct {
	// uid of the identity
	Name string `json:"name"`
}

// NewTeamBindingspecSubject creates a new TeamBindingspecSubject object.
func NewTeamBindingspecSubject() *TeamBindingspecSubject {
	return &TeamBindingspecSubject{}
}

// OpenAPIModelName returns the OpenAPI model name for TeamBindingspecSubject.
func (TeamBindingspecSubject) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamBindingspecSubject"
}

// +k8s:openapi-gen=true
type TeamBindingTeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name"`
}

// NewTeamBindingTeamRef creates a new TeamBindingTeamRef object.
func NewTeamBindingTeamRef() *TeamBindingTeamRef {
	return &TeamBindingTeamRef{}
}

// OpenAPIModelName returns the OpenAPI model name for TeamBindingTeamRef.
func (TeamBindingTeamRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamBindingTeamRef"
}

// +k8s:openapi-gen=true
type TeamBindingTeamPermission string

const (
	TeamBindingTeamPermissionAdmin  TeamBindingTeamPermission = "admin"
	TeamBindingTeamPermissionMember TeamBindingTeamPermission = "member"
)

// OpenAPIModelName returns the OpenAPI model name for TeamBindingTeamPermission.
func (TeamBindingTeamPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamBindingTeamPermission"
}

// +k8s:openapi-gen=true
type TeamBindingSpec struct {
	Subject TeamBindingspecSubject `json:"subject"`
	TeamRef TeamBindingTeamRef     `json:"teamRef"`
	// permission of the identity in the team
	Permission TeamBindingTeamPermission `json:"permission"`
	External   bool                      `json:"external"`
}

// NewTeamBindingSpec creates a new TeamBindingSpec object.
func NewTeamBindingSpec() *TeamBindingSpec {
	return &TeamBindingSpec{
		Subject: *NewTeamBindingspecSubject(),
		TeamRef: *NewTeamBindingTeamRef(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for TeamBindingSpec.
func (TeamBindingSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamBindingSpec"
}
