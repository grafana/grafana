// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserTeamTeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name"`
}

// NewUserTeamTeamRef creates a new UserTeamTeamRef object.
func NewUserTeamTeamRef() *UserTeamTeamRef {
	return &UserTeamTeamRef{}
}

// +k8s:openapi-gen=true
type UserTeamTeamPermission string

const (
	UserTeamTeamPermissionAdmin  UserTeamTeamPermission = "admin"
	UserTeamTeamPermissionMember UserTeamTeamPermission = "member"
)

// +k8s:openapi-gen=true
type UserTeamSpec struct {
	Title      string                 `json:"title"`
	TeamRef    UserTeamTeamRef        `json:"teamRef"`
	Permission UserTeamTeamPermission `json:"permission"`
}

// NewUserTeamSpec creates a new UserTeamSpec object.
func NewUserTeamSpec() *UserTeamSpec {
	return &UserTeamSpec{
		TeamRef: *NewUserTeamTeamRef(),
	}
}
