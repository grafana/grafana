// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamGroupsBody struct {
	ExternalGroups []string `json:"externalGroups"`
}

// NewGetTeamGroupsBody creates a new GetTeamGroupsBody object.
func NewGetTeamGroupsBody() *GetTeamGroupsBody {
	return &GetTeamGroupsBody{
		ExternalGroups: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamGroupsBody.
func (GetTeamGroupsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamGroupsBody"
}
