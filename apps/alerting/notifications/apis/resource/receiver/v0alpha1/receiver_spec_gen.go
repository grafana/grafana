package v0alpha1

// Integration defines model for Integration.
// +k8s:openapi-gen=true
type Integration struct {
	DisableResolveMessage *bool                  `json:"disableResolveMessage,omitempty"`
	SecureFields          map[string]bool        `json:"secureFields,omitempty"`
	Settings              map[string]interface{} `json:"settings"`
	Type                  string                 `json:"type"`
	Uid                   *string                `json:"uid,omitempty"`
}

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type Spec struct {
	Integrations []Integration `json:"integrations"`
	Title        string        `json:"title"`
}
