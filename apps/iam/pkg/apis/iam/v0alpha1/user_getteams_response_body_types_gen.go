// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamsUserTeam struct {
	User       string `json:"user"`
	Team       string `json:"team"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewGetTeamsUserTeam creates a new GetTeamsUserTeam object.
func NewGetTeamsUserTeam() *GetTeamsUserTeam {
	return &GetTeamsUserTeam{}
}

// +k8s:openapi-gen=true
type GetTeamsBody struct {
	Items []GetTeamsUserTeam `json:"items"`
}

// NewGetTeamsBody creates a new GetTeamsBody object.
func NewGetTeamsBody() *GetTeamsBody {
	return &GetTeamsBody{
		Items: []GetTeamsUserTeam{},
	}
}
func (GetTeamsUserTeam) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamsUserTeam"
}
func (GetTeamsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamsBody"
}
