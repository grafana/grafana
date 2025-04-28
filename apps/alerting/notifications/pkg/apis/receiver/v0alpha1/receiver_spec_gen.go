// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type Integration struct {
	Uid                   *string                `json:"uid,omitempty"`
	Type                  string                 `json:"type"`
	DisableResolveMessage *bool                  `json:"disableResolveMessage,omitempty"`
	Settings              map[string]interface{} `json:"settings"`
	SecureFields          map[string]bool        `json:"secureFields,omitempty"`
}

// NewIntegration creates a new Integration object.
func NewIntegration() *Integration {
	return &Integration{}
}

// +k8s:openapi-gen=true
type Spec struct {
	Title        string        `json:"title"`
	Integrations []Integration `json:"integrations"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}
