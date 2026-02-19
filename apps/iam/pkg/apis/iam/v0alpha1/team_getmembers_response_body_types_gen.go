// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser struct {
	Team       string `json:"team"`
	User       string `json:"user"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewVersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser creates a new VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser object.
func NewVersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser() *VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser {
	return &VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser{}
}

// +k8s:openapi-gen=true
type GetMembersBody struct {
	Items []VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser `json:"items"`
}

// NewGetMembersBody creates a new GetMembersBody object.
func NewGetMembersBody() *GetMembersBody {
	return &GetMembersBody{
		Items: []VersionsV0alpha1Kinds7RoutesMembersGETResponseTeamUser{},
	}
}
