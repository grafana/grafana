package v0alpha1

// Access secure values inside any resource
// +k8s:openapi-gen=true
type InlineSecureValue struct {
	// Create a secure value
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	Create ExposedSecureValue `json:"create,omitempty"`

	// Reference a shared secret (enterprise only)
	Reference string `json:"ref,omitempty"`

	// The resolved UID within the secret service
	UID string `json:"uid,omitempty"`

	// Remove this value -- cascading delete to the secret service if necessary
	Remove bool `json:"remove,omitempty"`
}

// Collection of secure values
// +k8s:openapi-gen=true
type InlineSecureValues = map[string]InlineSecureValue
