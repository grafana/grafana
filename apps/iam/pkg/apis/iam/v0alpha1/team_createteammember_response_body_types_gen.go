// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateTeamMemberBody struct {
	Team       string `json:"team"`
	User       string `json:"user"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}

// NewCreateTeamMemberBody creates a new CreateTeamMemberBody object.
func NewCreateTeamMemberBody() *CreateTeamMemberBody {
	return &CreateTeamMemberBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateTeamMemberBody.
func (CreateTeamMemberBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateTeamMemberBody"
}
