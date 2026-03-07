// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateReceiverIntegrationTestBody struct {
	Status   CreateReceiverIntegrationTestBodyStatus `json:"status"`
	Duration string                                  `json:"duration"`
	Error    *string                                 `json:"error,omitempty"`
}

// NewCreateReceiverIntegrationTestBody creates a new CreateReceiverIntegrationTestBody object.
func NewCreateReceiverIntegrationTestBody() *CreateReceiverIntegrationTestBody {
	return &CreateReceiverIntegrationTestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestBody.
func (CreateReceiverIntegrationTestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestBody"
}

// +k8s:openapi-gen=true
type CreateReceiverIntegrationTestBodyStatus string

const (
	CreateReceiverIntegrationTestBodyStatusSuccess CreateReceiverIntegrationTestBodyStatus = "success"
	CreateReceiverIntegrationTestBodyStatusFailure CreateReceiverIntegrationTestBodyStatus = "failure"
)

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestBodyStatus.
func (CreateReceiverIntegrationTestBodyStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestBodyStatus"
}
