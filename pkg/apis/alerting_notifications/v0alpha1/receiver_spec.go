package v0alpha1

import "encoding/json"

// Integration defines model for Integration.
// +k8s:openapi-gen=true
type Integration struct {
	DisableResolveMessage *bool `json:"disableResolveMessage,omitempty"`
	// +mapType=atomic
	SecureFields map[string]bool `json:"SecureFields,omitempty"`
	// +listType=atomic
	Settings json.RawMessage `json:"settings"`
	Type     string          `json:"type"`
	Uid      *string         `json:"uid,omitempty"`
}

// ReceiverSpec defines model for Spec.
// +k8s:openapi-gen=true
type ReceiverSpec struct {
	// +listType=atomic
	Integrations []Integration `json:"integrations"`
	Title        string        `json:"title"`
}
