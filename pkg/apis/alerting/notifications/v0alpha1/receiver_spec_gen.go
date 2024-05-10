package v0alpha1

import (
	"encoding/json"
)

// ReceiverIntegration defines model for ReceiverIntegration.
type ReceiverIntegration struct {
	DisableResolveMessage *bool           `json:"disableResolveMessage,omitempty"`
	Settings              json.RawMessage `json:"settings"`
	Type                  string          `json:"type"`
	Uid                   *string         `json:"uid,omitempty"`
}

// ReceiverSpec defines model for ReceiverSpec.
type ReceiverSpec struct {
	Integrations []ReceiverIntegration `json:"integrations"`
}
