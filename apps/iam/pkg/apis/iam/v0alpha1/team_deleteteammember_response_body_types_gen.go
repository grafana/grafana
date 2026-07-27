// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DeleteTeamMemberBody struct {
	Team string `json:"team"`
	User string `json:"user"`
}

// NewDeleteTeamMemberBody creates a new DeleteTeamMemberBody object.
func NewDeleteTeamMemberBody() *DeleteTeamMemberBody {
	return &DeleteTeamMemberBody{}
}

// OpenAPIModelName returns the OpenAPI model name for DeleteTeamMemberBody.
func (DeleteTeamMemberBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.DeleteTeamMemberBody"
}
