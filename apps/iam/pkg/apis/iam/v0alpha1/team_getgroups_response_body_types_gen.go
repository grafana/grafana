// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping struct {
	Name          string `json:"name"`
	ExternalGroup string `json:"externalGroup"`
}

// NewVersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping creates a new VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping object.
func NewVersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping() *VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping {
	return &VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping{}
}

// +k8s:openapi-gen=true
type GetGroupsBody struct {
	Items []VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping `json:"items"`
}

// NewGetGroupsBody creates a new GetGroupsBody object.
func NewGetGroupsBody() *GetGroupsBody {
	return &GetGroupsBody{
		Items: []VersionsV0alpha1Kinds7RoutesGroupsGETResponseExternalGroupMapping{},
	}
}
