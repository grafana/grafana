// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// ExposedSecureValue contains the raw decrypted secure value.
// +k8s:openapi-gen=true
type SecureValueExposedSecureValue string

// +k8s:openapi-gen=true
type SecureValueSpec struct {
	// Short description that explains the purpose of this SecureValue.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=25
	Description string `json:"description"`
	// The raw value is only valid for write. Read/List will always be empty.
	// There is no support for mixing `value` and `ref`, you can't create a secret in a third-party keeper with a specified `ref`.
	// Minimum and maximum lengths in bytes.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	// +optional
	Value *SecureValueExposedSecureValue `json:"value,omitempty"`
	// When using a third-party keeper, the `ref` is used to reference a value inside the remote storage.
	// This should not contain sensitive information.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=1024
	// +optional
	Ref *string `json:"ref,omitempty"`
	// Name of the keeper, being the actual storage of the secure value.
	// If not specified, the default keeper for the namespace will be used.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	// +optional
	Keeper *string `json:"keeper,omitempty"`
	// The Decrypters that are allowed to decrypt this secret.
	// An empty list means no service can decrypt it.
	// +k8s:validation:maxItems=64
	// +k8s:validation:uniqueItems=true
	// +listType=atomic
	// +optional
	Decrypters []string `json:"decrypters,omitempty"`
}

// NewSecureValueSpec creates a new SecureValueSpec object.
func NewSecureValueSpec() *SecureValueSpec {
	return &SecureValueSpec{}
}
