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
	Integration    *CreateReceiverIntegrationTestRequestIntegration                `json:"integration,omitempty"`
	IntegrationRef *CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef `json:"integrationRef,omitempty"`
	Alert          CreateReceiverIntegrationTestRequestAlert                       `json:"alert"`
}

// NewCreateReceiverIntegrationTestRequestBody creates a new CreateReceiverIntegrationTestRequestBody object.
func NewCreateReceiverIntegrationTestRequestBody() *CreateReceiverIntegrationTestRequestBody {
	return &CreateReceiverIntegrationTestRequestBody{
		Alert: *NewCreateReceiverIntegrationTestRequestAlert(),
	}
}

type CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef struct {
	Uid string `json:"uid"`
}

// NewCreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef creates a new CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef object.
func NewCreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef() *CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef {
	return &CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{}
}
