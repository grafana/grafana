// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateTeamMemberRequestBody struct {
	Name       string `json:"name"`
	Permission string `json:"permission"`
	// external marks the membership origin: true = added by team sync, false = added manually. Honored on a fresh add only; on re-add the existing member's origin is preserved and this field is ignored.
	External bool `json:"external"`
}

// NewCreateTeamMemberRequestBody creates a new CreateTeamMemberRequestBody object.
func NewCreateTeamMemberRequestBody() *CreateTeamMemberRequestBody {
	return &CreateTeamMemberRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateTeamMemberRequestBody.
func (CreateTeamMemberRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateTeamMemberRequestBody"
}
