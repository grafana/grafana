// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetMembersTeamUser struct {
	Team       string `json:"team"`
	User       string `json:"user"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewGetMembersTeamUser creates a new GetMembersTeamUser object.
func NewGetMembersTeamUser() *GetMembersTeamUser {
	return &GetMembersTeamUser{}
}

// OpenAPIModelName returns the OpenAPI model name for GetMembersTeamUser.
func (GetMembersTeamUser) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetMembersTeamUser"
}

// +k8s:openapi-gen=true
type GetMembersBody struct {
	Items []GetMembersTeamUser `json:"items"`
}

// NewGetMembersBody creates a new GetMembersBody object.
func NewGetMembersBody() *GetMembersBody {
	return &GetMembersBody{
		Items: []GetMembersTeamUser{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetMembersBody.
func (GetMembersBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetMembersBody"
}
