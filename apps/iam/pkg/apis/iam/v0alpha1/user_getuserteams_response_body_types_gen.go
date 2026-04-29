// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetUserTeamsUserTeam struct {
	User       string `json:"user"`
	Team       string `json:"team"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewGetUserTeamsUserTeam creates a new GetUserTeamsUserTeam object.
func NewGetUserTeamsUserTeam() *GetUserTeamsUserTeam {
	return &GetUserTeamsUserTeam{}
}

// OpenAPIModelName returns the OpenAPI model name for GetUserTeamsUserTeam.
func (GetUserTeamsUserTeam) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetUserTeamsUserTeam"
}

// +k8s:openapi-gen=true
type GetUserTeamsBody struct {
	Items []GetUserTeamsUserTeam `json:"items"`
}

// NewGetUserTeamsBody creates a new GetUserTeamsBody object.
func NewGetUserTeamsBody() *GetUserTeamsBody {
	return &GetUserTeamsBody{
		Items: []GetUserTeamsUserTeam{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetUserTeamsBody.
func (GetUserTeamsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetUserTeamsBody"
}
