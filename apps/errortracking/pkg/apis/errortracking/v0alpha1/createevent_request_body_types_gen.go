// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateEventRequestBody struct {
	Project    string `json:"project"`
	Message    string `json:"message"`
	OccurredAt *int64 `json:"occurredAt,omitempty"`
}

// NewCreateEventRequestBody creates a new CreateEventRequestBody object.
func NewCreateEventRequestBody() *CreateEventRequestBody {
	return &CreateEventRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateEventRequestBody.
func (CreateEventRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.errortracking.pkg.apis.errortracking.v0alpha1.CreateEventRequestBody"
}
