// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamSpec struct {
	Title string `json:"title"`
	Email string `json:"email"`
}

// NewTeamSpec creates a new TeamSpec object.
func NewTeamSpec() *TeamSpec {
	return &TeamSpec{}
}
