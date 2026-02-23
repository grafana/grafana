// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetGroupsExternalGroupMapping struct {
	Name          string `json:"name"`
	ExternalGroup string `json:"externalGroup"`
}

// NewGetGroupsExternalGroupMapping creates a new GetGroupsExternalGroupMapping object.
func NewGetGroupsExternalGroupMapping() *GetGroupsExternalGroupMapping {
	return &GetGroupsExternalGroupMapping{}
}

// OpenAPIModelName returns the OpenAPI model name for GetGroupsExternalGroupMapping.
func (GetGroupsExternalGroupMapping) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetGroupsExternalGroupMapping"
}

// +k8s:openapi-gen=true
type GetGroupsBody struct {
	Items []GetGroupsExternalGroupMapping `json:"items"`
}

// NewGetGroupsBody creates a new GetGroupsBody object.
func NewGetGroupsBody() *GetGroupsBody {
	return &GetGroupsBody{
		Items: []GetGroupsExternalGroupMapping{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetGroupsBody.
func (GetGroupsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetGroupsBody"
}
