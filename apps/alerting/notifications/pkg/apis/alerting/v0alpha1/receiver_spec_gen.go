// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ReceiverIntegration struct {
	Uid                   *string                `json:"uid,omitempty"`
	Type                  string                 `json:"type"`
	DisableResolveMessage *bool                  `json:"disableResolveMessage,omitempty"`
	Settings              map[string]interface{} `json:"settings"`
	SecureFields          map[string]bool        `json:"secureFields,omitempty"`
}

// NewReceiverIntegration creates a new ReceiverIntegration object.
func NewReceiverIntegration() *ReceiverIntegration {
	return &ReceiverIntegration{
		Settings: map[string]interface{}{},
	}
}

// +k8s:openapi-gen=true
type ReceiverSpec struct {
	Title        string                `json:"title"`
	Integrations []ReceiverIntegration `json:"integrations"`
}

// NewReceiverSpec creates a new ReceiverSpec object.
func NewReceiverSpec() *ReceiverSpec {
	return &ReceiverSpec{
		Integrations: []ReceiverIntegration{},
	}
}
