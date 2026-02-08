// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateRegisterBody struct {
	Message string `json:"message"`
}

// NewCreateRegisterBody creates a new CreateRegisterBody object.
func NewCreateRegisterBody() *CreateRegisterBody {
	return &CreateRegisterBody{}
}
func (CreateRegisterBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.CreateRegisterBody"
}
