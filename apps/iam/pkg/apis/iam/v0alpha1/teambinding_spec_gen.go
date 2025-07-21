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
type TeamBindingTeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name"`
}

// NewTeamBindingTeamRef creates a new TeamBindingTeamRef object.
func NewTeamBindingTeamRef() *TeamBindingTeamRef {
	return &TeamBindingTeamRef{}
}

// +k8s:openapi-gen=true
type TeamBindingSpec struct {
	Subjects []TeamBindingspecSubject `json:"subjects"`
	TeamRef  TeamBindingTeamRef       `json:"teamRef"`
}

// NewTeamBindingSpec creates a new TeamBindingSpec object.
func NewTeamBindingSpec() *TeamBindingSpec {
	return &TeamBindingSpec{
		Subjects: []TeamBindingspecSubject{},
		TeamRef:  *NewTeamBindingTeamRef(),
	}
}
