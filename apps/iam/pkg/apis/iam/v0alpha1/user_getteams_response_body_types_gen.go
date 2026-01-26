// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam struct {
	TeamRef    TeamRef        `json:"teamRef"`
	Permission TeamPermission `json:"permission"`
	External   bool           `json:"external"`
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
type GetTeamsBody struct {
	Items []VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam `json:"items"`
}

// NewGetTeamsBody creates a new GetTeamsBody object.
func NewGetTeamsBody() *GetTeamsBody {
	return &GetTeamsBody{
		Items: []VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{},
	}
}
