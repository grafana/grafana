// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam struct {
	User       string `json:"user"`
	Team       string `json:"team"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewVersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam creates a new VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam object.
func NewVersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam() *VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam {
	return &VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{}
}

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
