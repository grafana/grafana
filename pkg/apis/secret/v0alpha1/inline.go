package v0alpha1

// Access secure values inside any resource
// +k8s:openapi-gen=true
type InlineSecureValue struct {
	// Create a secure value -- this is only used for POST/PUT
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	Create ExposedSecureValue `json:"create,omitempty"`

	// Name in the secret service (reference)
	Name string `json:"name,omitempty"`

	// The secret is shared (enterprise only)
	Shared bool `json:"shared,omitempty"`

	// Remove this value -- cascading delete to the secret service if necessary
	Remove bool `json:"remove,omitempty,omitzero"`
}

// Collection of secure values
// +k8s:openapi-gen=true
type InlineSecureValues = map[string]InlineSecureValue
