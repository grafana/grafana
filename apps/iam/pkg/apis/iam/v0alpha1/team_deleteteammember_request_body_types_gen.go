// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type DeleteTeamMemberRequestBody struct {
	Name string `json:"name"`
}

// NewDeleteTeamMemberRequestBody creates a new DeleteTeamMemberRequestBody object.
func NewDeleteTeamMemberRequestBody() *DeleteTeamMemberRequestBody {
	return &DeleteTeamMemberRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for DeleteTeamMemberRequestBody.
func (DeleteTeamMemberRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.DeleteTeamMemberRequestBody"
}
