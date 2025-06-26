// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamBindingspecSubject struct {
	// uid of the identity
	Name string `json:"name"`
	// permission of the identity in the team
	Permission TeamBindingTeamPermission `json:"permission"`
}

// NewTeamBindingspecSubject creates a new TeamBindingspecSubject object.
func NewTeamBindingspecSubject() *TeamBindingspecSubject {
	return &TeamBindingspecSubject{}
}

// +k8s:openapi-gen=true
type TeamBindingTeamPermission string

const (
	TeamBindingTeamPermissionAdmin  TeamBindingTeamPermission = "admin"
	TeamBindingTeamPermissionMember TeamBindingTeamPermission = "member"
)

// +k8s:openapi-gen=true
type TeamBindingspecTeamRef struct {
	// uid of the Team
	Name string `json:"name"`
}

// NewTeamBindingspecTeamRef creates a new TeamBindingspecTeamRef object.
func NewTeamBindingspecTeamRef() *TeamBindingspecTeamRef {
	return &TeamBindingspecTeamRef{}
}

// +k8s:openapi-gen=true
type TeamBindingSpec struct {
	Subjects []TeamBindingspecSubject `json:"subjects"`
	TeamRef  TeamBindingspecTeamRef   `json:"teamRef"`
}

// NewTeamBindingSpec creates a new TeamBindingSpec object.
func NewTeamBindingSpec() *TeamBindingSpec {
	return &TeamBindingSpec{
		Subjects: []TeamBindingspecSubject{},
		TeamRef:  *NewTeamBindingspecTeamRef(),
	}
}
