// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ExternalGroupMappingTeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name"`
}

// NewExternalGroupMappingTeamRef creates a new ExternalGroupMappingTeamRef object.
func NewExternalGroupMappingTeamRef() *ExternalGroupMappingTeamRef {
	return &ExternalGroupMappingTeamRef{}
}

// +k8s:openapi-gen=true
type ExternalGroupMappingSpec struct {
	TeamRef         ExternalGroupMappingTeamRef `json:"teamRef"`
	ExternalGroupId string                      `json:"externalGroupId"`
}

// NewExternalGroupMappingSpec creates a new ExternalGroupMappingSpec object.
func NewExternalGroupMappingSpec() *ExternalGroupMappingSpec {
	return &ExternalGroupMappingSpec{
		TeamRef: *NewExternalGroupMappingTeamRef(),
	}
}
