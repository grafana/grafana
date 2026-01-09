// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetIntegrationTestRequestAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

// NewGetIntegrationTestRequestAlert creates a new GetIntegrationTestRequestAlert object.
func NewGetIntegrationTestRequestAlert() *GetIntegrationTestRequestAlert {
	return &GetIntegrationTestRequestAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

type GetIntegrationTestRequestIntegration struct {
	Uid                   *string         `json:"uid,omitempty"`
	Type                  string          `json:"type"`
	Version               string          `json:"version"`
	DisableResolveMessage *bool           `json:"disableResolveMessage,omitempty"`
	Settings              map[string]any  `json:"settings"`
	SecureFields          map[string]bool `json:"secureFields,omitempty"`
}

// NewGetIntegrationTestRequestIntegration creates a new GetIntegrationTestRequestIntegration object.
func NewGetIntegrationTestRequestIntegration() *GetIntegrationTestRequestIntegration {
	return &GetIntegrationTestRequestIntegration{
		Settings: map[string]any{},
	}
}

type GetIntegrationTestRequestBody struct {
	Alert       GetIntegrationTestRequestAlert       `json:"alert"`
	ReceiverRef *string                              `json:"receiver_ref,omitempty"`
	Integration GetIntegrationTestRequestIntegration `json:"integration"`
}

// NewGetIntegrationTestRequestBody creates a new GetIntegrationTestRequestBody object.
func NewGetIntegrationTestRequestBody() *GetIntegrationTestRequestBody {
	return &GetIntegrationTestRequestBody{
		Alert:       *NewGetIntegrationTestRequestAlert(),
		Integration: *NewGetIntegrationTestRequestIntegration(),
	}
}
