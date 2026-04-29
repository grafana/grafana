// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateReceiverIntegrationTestRequestIntegration struct {
	Uid                   *string         `json:"uid,omitempty"`
	Type                  string          `json:"type"`
	Version               string          `json:"version"`
	DisableResolveMessage *bool           `json:"disableResolveMessage,omitempty"`
	Settings              map[string]any  `json:"settings"`
	SecureFields          map[string]bool `json:"secureFields,omitempty"`
}

// NewCreateReceiverIntegrationTestRequestIntegration creates a new CreateReceiverIntegrationTestRequestIntegration object.
func NewCreateReceiverIntegrationTestRequestIntegration() *CreateReceiverIntegrationTestRequestIntegration {
	return &CreateReceiverIntegrationTestRequestIntegration{
		Settings: map[string]any{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestRequestIntegration.
func (CreateReceiverIntegrationTestRequestIntegration) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestRequestIntegration"
}

type CreateReceiverIntegrationTestRequestAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

// NewCreateReceiverIntegrationTestRequestAlert creates a new CreateReceiverIntegrationTestRequestAlert object.
func NewCreateReceiverIntegrationTestRequestAlert() *CreateReceiverIntegrationTestRequestAlert {
	return &CreateReceiverIntegrationTestRequestAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestRequestAlert.
func (CreateReceiverIntegrationTestRequestAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestRequestAlert"
}

type CreateReceiverIntegrationTestRequestBody struct {
	Integration CreateReceiverIntegrationTestRequestIntegration `json:"integration"`
	Alert       CreateReceiverIntegrationTestRequestAlert       `json:"alert"`
}

// NewCreateReceiverIntegrationTestRequestBody creates a new CreateReceiverIntegrationTestRequestBody object.
func NewCreateReceiverIntegrationTestRequestBody() *CreateReceiverIntegrationTestRequestBody {
	return &CreateReceiverIntegrationTestRequestBody{
		Integration: *NewCreateReceiverIntegrationTestRequestIntegration(),
		Alert:       *NewCreateReceiverIntegrationTestRequestAlert(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestRequestBody.
func (CreateReceiverIntegrationTestRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.CreateReceiverIntegrationTestRequestBody"
}
