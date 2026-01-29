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
