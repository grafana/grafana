// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam struct {
	Title      string         `json:"title"`
	TeamRef    TeamRef        `json:"teamRef"`
	Permission TeamPermission `json:"permission"`
}

// NewVersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam creates a new VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam object.
func NewVersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam() *VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam {
	return &VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{
		TeamRef: *NewTeamRef(),
	}
}

// +k8s:openapi-gen=true
type TeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name"`
}

// NewTeamRef creates a new TeamRef object.
func NewTeamRef() *TeamRef {
	return &TeamRef{}
}

// +k8s:openapi-gen=true
type TeamPermission string

const (
	TeamPermissionAdmin  TeamPermission = "admin"
	TeamPermissionMember TeamPermission = "member"
)

// +k8s:openapi-gen=true
type GetTeams struct {
	Items []VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam `json:"items"`
}

// NewGetTeams creates a new GetTeams object.
func NewGetTeams() *GetTeams {
	return &GetTeams{
		Items: []VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{},
	}
}
