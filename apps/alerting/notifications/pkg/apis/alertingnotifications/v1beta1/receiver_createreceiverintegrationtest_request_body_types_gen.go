// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// The test route takes one integration in its request body, and codegen does not allow
// a union there, so that route keeps the flat shape.
type CreateReceiverIntegrationTestRequestIntegrationInput struct {
	Uid                   *string         `json:"uid,omitempty"`
	Type                  string          `json:"type"`
	Version               string          `json:"version"`
	DisableResolveMessage *bool           `json:"disableResolveMessage,omitempty"`
	Settings              map[string]any  `json:"settings"`
	SecureFields          map[string]bool `json:"secureFields,omitempty"`
}

// NewCreateReceiverIntegrationTestRequestIntegrationInput creates a new CreateReceiverIntegrationTestRequestIntegrationInput object.
func NewCreateReceiverIntegrationTestRequestIntegrationInput() *CreateReceiverIntegrationTestRequestIntegrationInput {
	return &CreateReceiverIntegrationTestRequestIntegrationInput{
		Settings: map[string]any{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestRequestIntegrationInput.
func (CreateReceiverIntegrationTestRequestIntegrationInput) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.CreateReceiverIntegrationTestRequestIntegrationInput"
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
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.CreateReceiverIntegrationTestRequestAlert"
}

type CreateReceiverIntegrationTestRequestBody struct {
	Integration CreateReceiverIntegrationTestRequestIntegrationInput `json:"integration"`
	Alert       CreateReceiverIntegrationTestRequestAlert            `json:"alert"`
}

// NewCreateReceiverIntegrationTestRequestBody creates a new CreateReceiverIntegrationTestRequestBody object.
func NewCreateReceiverIntegrationTestRequestBody() *CreateReceiverIntegrationTestRequestBody {
	return &CreateReceiverIntegrationTestRequestBody{
		Integration: *NewCreateReceiverIntegrationTestRequestIntegrationInput(),
		Alert:       *NewCreateReceiverIntegrationTestRequestAlert(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReceiverIntegrationTestRequestBody.
func (CreateReceiverIntegrationTestRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.CreateReceiverIntegrationTestRequestBody"
}
