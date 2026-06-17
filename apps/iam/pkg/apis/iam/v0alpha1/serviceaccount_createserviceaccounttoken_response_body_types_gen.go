// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateServiceAccountTokenBody struct {
	Token                   string `json:"token"`
	ServiceAccountTokenName string `json:"serviceAccountTokenName"`
	Expires                 int64  `json:"expires"`
}

// NewCreateServiceAccountTokenBody creates a new CreateServiceAccountTokenBody object.
func NewCreateServiceAccountTokenBody() *CreateServiceAccountTokenBody {
	return &CreateServiceAccountTokenBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateServiceAccountTokenBody.
func (CreateServiceAccountTokenBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateServiceAccountTokenBody"
}
