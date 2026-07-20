// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DeleteServiceAccountTokenBody struct {
	Message string `json:"message"`
}

// NewDeleteServiceAccountTokenBody creates a new DeleteServiceAccountTokenBody object.
func NewDeleteServiceAccountTokenBody() *DeleteServiceAccountTokenBody {
	return &DeleteServiceAccountTokenBody{}
}

// OpenAPIModelName returns the OpenAPI model name for DeleteServiceAccountTokenBody.
func (DeleteServiceAccountTokenBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.DeleteServiceAccountTokenBody"
}
