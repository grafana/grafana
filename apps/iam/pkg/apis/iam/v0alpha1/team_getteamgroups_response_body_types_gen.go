// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamGroupsExternalGroupMapping struct {
	Name          string `json:"name"`
	ExternalGroup string `json:"externalGroup"`
}

// NewGetTeamGroupsExternalGroupMapping creates a new GetTeamGroupsExternalGroupMapping object.
func NewGetTeamGroupsExternalGroupMapping() *GetTeamGroupsExternalGroupMapping {
	return &GetTeamGroupsExternalGroupMapping{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamGroupsExternalGroupMapping.
func (GetTeamGroupsExternalGroupMapping) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamGroupsExternalGroupMapping"
}

// +k8s:openapi-gen=true
type GetTeamGroupsBody struct {
	Items []GetTeamGroupsExternalGroupMapping `json:"items"`
}

// NewGetTeamGroupsBody creates a new GetTeamGroupsBody object.
func NewGetTeamGroupsBody() *GetTeamGroupsBody {
	return &GetTeamGroupsBody{
		Items: []GetTeamGroupsExternalGroupMapping{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamGroupsBody.
func (GetTeamGroupsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamGroupsBody"
}
