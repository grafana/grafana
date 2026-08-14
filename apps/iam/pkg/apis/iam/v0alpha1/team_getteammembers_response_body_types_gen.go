// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamMembersTeamUser struct {
	Team       string `json:"team"`
	User       string `json:"user"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewGetTeamMembersTeamUser creates a new GetTeamMembersTeamUser object.
func NewGetTeamMembersTeamUser() *GetTeamMembersTeamUser {
	return &GetTeamMembersTeamUser{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamMembersTeamUser.
func (GetTeamMembersTeamUser) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamMembersTeamUser"
}

// +k8s:openapi-gen=true
type GetTeamMembersBody struct {
	Items []GetTeamMembersTeamUser `json:"items"`
}

// NewGetTeamMembersBody creates a new GetTeamMembersBody object.
func NewGetTeamMembersBody() *GetTeamMembersBody {
	return &GetTeamMembersBody{
		Items: []GetTeamMembersTeamUser{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamMembersBody.
func (GetTeamMembersBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamMembersBody"
}
