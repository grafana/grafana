// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateEventBody struct {
	Status string `json:"status"`
}

// NewCreateEventBody creates a new CreateEventBody object.
func NewCreateEventBody() *CreateEventBody {
	return &CreateEventBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateEventBody.
func (CreateEventBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.errortracking.pkg.apis.errortracking.v0alpha1.CreateEventBody"
}
