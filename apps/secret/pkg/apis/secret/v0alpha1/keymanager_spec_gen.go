package v0alpha1

// Defines values for KeyManagerSpecProvider.
const (
	KeyManagerSpecProviderAwskms KeyManagerSpecProvider = "awskms"
)

// KeyManagerAWSKMSConfig defines model for KeyManagerAWSKMSConfig.
// +k8s:openapi-gen=true
type KeyManagerAWSKMSConfig struct {
	Arn string `json:"arn"`
}

// KeyManagerSpec defines model for KeyManagerSpec.
// +k8s:openapi-gen=true
type KeyManagerSpec struct {
	Awskms *KeyManagerspecAWSKMSConfig `json:"awskms,omitempty"`

	// The APIs that are allowed to decrypt this secret
	Provider KeyManagerSpecProvider `json:"provider"`

	// User visible title for the key manager
	Title string `json:"title"`
}

// The APIs that are allowed to decrypt this secret
// +k8s:openapi-gen=true
type KeyManagerSpecProvider string

// KeyManagerspecAWSKMSConfig defines model for KeyManagerspec.#AWSKMSConfig.
// +k8s:openapi-gen=true
type KeyManagerspecAWSKMSConfig struct {
	Arn string `json:"arn"`
}
