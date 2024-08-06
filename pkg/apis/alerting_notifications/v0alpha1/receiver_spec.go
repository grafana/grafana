package v0alpha1

import (
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Integration defines model for Integration.
// +k8s:openapi-gen=true
type Integration struct {
	DisableResolveMessage *bool `json:"disableResolveMessage,omitempty"`
	// +mapType=atomic
	SecureFields map[string]bool     `json:"secureFields,omitempty"`
	Settings     common.Unstructured `json:"settings"`
	Type         string              `json:"type"`
	Uid          *string             `json:"uid,omitempty"`
}

// ReceiverSpec defines model for Spec.
// +k8s:openapi-gen=true
type ReceiverSpec struct {
	// +listType=atomic
	Integrations []Integration `json:"integrations"`
	Title        string        `json:"title"`
}
