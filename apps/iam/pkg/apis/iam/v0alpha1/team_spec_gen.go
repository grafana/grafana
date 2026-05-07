// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamTeamMember struct {
	// kind of the identity
	Kind string `json:"kind"`
	// uid of the identity
	Name string `json:"name"`
	// permission of the identity in the team
	Permission TeamTeamPermission `json:"permission"`
	// whether the member was added externally (e.g. team sync)
	External bool `json:"external"`
}

// NewTeamTeamMember creates a new TeamTeamMember object.
func NewTeamTeamMember() *TeamTeamMember {
	return &TeamTeamMember{
		Kind: "User",
	}
}

// OpenAPIModelName returns the OpenAPI model name for TeamTeamMember.
func (TeamTeamMember) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamTeamMember"
}

// +k8s:openapi-gen=true
type TeamTeamPermission string

const (
	TeamTeamPermissionAdmin  TeamTeamPermission = "admin"
	TeamTeamPermissionMember TeamTeamPermission = "member"
)

// OpenAPIModelName returns the OpenAPI model name for TeamTeamPermission.
func (TeamTeamPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamTeamPermission"
}

// +k8s:openapi-gen=true
type TeamSpec struct {
	Title       string           `json:"title"`
	Email       string           `json:"email"`
	Provisioned bool             `json:"provisioned"`
	ExternalUID string           `json:"externalUID"`
	Members     []TeamTeamMember `json:"members"`
}

// NewTeamSpec creates a new TeamSpec object.
func NewTeamSpec() *TeamSpec {
	return &TeamSpec{
		Members: []TeamTeamMember{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for TeamSpec.
func (TeamSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamSpec"
}
