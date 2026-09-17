// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateHitRequestBody struct {
	Color string `json:"color"`
	Shape string `json:"shape"`
}

// NewCreateHitRequestBody creates a new CreateHitRequestBody object.
func NewCreateHitRequestBody() *CreateHitRequestBody {
	return &CreateHitRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateHitRequestBody.
func (CreateHitRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.CreateHitRequestBody"
}
