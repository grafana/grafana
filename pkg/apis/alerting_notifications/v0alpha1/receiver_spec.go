package v0alpha1

// Integration defines model for Integration.
// +k8s:openapi-gen=true
type Integration struct {
	DisableResolveMessage *bool `json:"disableResolveMessage,omitempty"`

	// +listType=atomic
	Settings []byte  `json:"settings"`
	Type     string  `json:"type"`
	Uid      *string `json:"uid,omitempty"`
}

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type Spec struct {
	// +listType=atomic
	Integrations []Integration `json:"integrations"`
	Title        string        `json:"title"`
}
