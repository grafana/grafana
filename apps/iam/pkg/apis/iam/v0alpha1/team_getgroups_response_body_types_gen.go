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
func (GetGroupsExternalGroupMapping) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetGroupsExternalGroupMapping"
}
func (GetGroupsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetGroupsBody"
}
