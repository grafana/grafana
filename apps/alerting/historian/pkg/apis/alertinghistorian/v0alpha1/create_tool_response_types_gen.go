// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateToolResponse struct {
	// Summary is a natural language summary of the operation result.
	Summary string `json:"summary"`
}

// NewCreateToolResponse creates a new CreateToolResponse object.
func NewCreateToolResponse() *CreateToolResponse {
	return &CreateToolResponse{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateToolResponse.
func (CreateToolResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolResponse"
}
