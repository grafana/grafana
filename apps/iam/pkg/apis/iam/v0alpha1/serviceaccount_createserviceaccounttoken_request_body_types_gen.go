// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateServiceAccountTokenRequestBody struct {
	TokenName        string `json:"tokenName"`
	ExpiresInSeconds int64  `json:"expiresInSeconds"`
}

// NewCreateServiceAccountTokenRequestBody creates a new CreateServiceAccountTokenRequestBody object.
func NewCreateServiceAccountTokenRequestBody() *CreateServiceAccountTokenRequestBody {
	return &CreateServiceAccountTokenRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateServiceAccountTokenRequestBody.
func (CreateServiceAccountTokenRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateServiceAccountTokenRequestBody"
}
