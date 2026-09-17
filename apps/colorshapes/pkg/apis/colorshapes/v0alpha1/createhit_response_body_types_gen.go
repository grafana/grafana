// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateHitBody struct {
	Status string `json:"status"`
}

// NewCreateHitBody creates a new CreateHitBody object.
func NewCreateHitBody() *CreateHitBody {
	return &CreateHitBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateHitBody.
func (CreateHitBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.CreateHitBody"
}
