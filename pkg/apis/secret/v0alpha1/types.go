package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SecureValue struct {
	metav1.TypeMeta `json:",inline"`

	// Standard object's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// This is the actual secure value schema.
	Spec SecureValueSpec `json:"spec,omitempty"`
}

type SecureValueSpec struct {
	// Visible title for this secret.
	Title string `json:"title"`

	// Name of the manager. This is only supported in enterprise.
	Manager string `json:"manager,omitempty"`

	// The raw value is only valid for write. Read/List will always be empty
	// Writing with an empty value will always fail
	Value string `json:"value,omitempty"`

	// When using a remote Key manager, the path is used to
	// reference a value inside the remote storage
	// NOTE: this value is only expected on write
	Path string `json:"path,omitempty"`

	// The Audiences that are allowed to decrypt this secret
	// Support and behavior is still TBD, but could likely look like:
	// * testdata.grafana.app/{name1}
	// * testdata.grafana.app/{name2}
	// * runner.k6.grafana.app  -- allow any k6 test runner
	// Rather than a string pattern, we may want a more explicit object:
	// [{ group:"testdata.grafana.app", name="name1"},
	//  { group:"runner.k6.grafana.app"}]
	// +listType=atomic
	Audiences []string `json:"audiences"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SecureValueList struct {
	metav1.TypeMeta `json:",inline"`

	// Standard list's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	// Slice containing all secure values. This will NOT output decrypted values.
	Items []SecureValue `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type KeyManager struct {
	metav1.TypeMeta `json:",inline"`

	// Standard object's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// This is the actual key manager schema.
	Spec KeyManagerSpec `json:"spec,omitempty"`
}

// KeyManagementProvider defines the types of supported KeyManagers
// +enum
type KeyManagementProvider string

// KeyManagementProvider values
const (
	GCPKMSProvider         KeyManagementProvider = "gcpkms"
	AWSKMSProvider         KeyManagementProvider = "awskms"
	AzureKeyVaultProvider  KeyManagementProvider = "azurekeyvault"
	HashiCorpVaultProvider KeyManagementProvider = "hashivault"
)

// Enterprise only key managers.
// TODO: this is probably not the schema we want.
type KeyManagerSpec struct {
	// User visible title for the key manager
	Title string `json:"title"`

	// The APIs that are allowed to decrypt this secret
	Provider KeyManagementProvider `json:"provider"`

	// Used when provider == gcpkms
	// +optional
	GCPKMS *GCPKMSConfig `json:"gcpkms,omitempty"`

	// Used when provider == awskms
	// +optional
	AWSKMS *AWSKMSConfig `json:"awskms,omitempty"`

	// Used when provider == azurekeyvault
	// +optional
	AzureKeyVault *AzureKeyVaultConfig `json:"azurekeyvault,omitempty"`

	// Used when provider == hashivault
	// +optional
	HashiCorpVault *HashiCorpVaultConfig `json:"hashivault,omitempty"`
}

type GCPKMSConfig struct {
	// gcpkms://projects/MYPROJECT/locations/MYLOCATION/keyRings/MYKEYRING/cryptoKeys/MYKEY
	URL string `json:"url"`
}

type AWSKMSConfig struct {
	// arn:aws:kms:us-east-1:111122223333:key/
	ARN string `json:"arn"`
}

type AzureKeyVaultConfig struct {
	// mykeyvaultname.vault.azure.net/keys/mykeyname
	URL string `json:"url"`
}

type HashiCorpVaultConfig struct {
	URL string `json:"url"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type KeyManagerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []KeyManager `json:"items,omitempty"`
}

// Subresource that provides history for how an item has been managed over time
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SecureValueActivityList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SecureValueActivity `json:"items,omitempty"`
}

// TODO: Because this is a subresource, it doesn't need:
// - metav1.TypeMeta `json:",inline"`
// - metav1.ObjectMeta `json:"metadata,omitempty"`
// ?
type SecureValueActivity struct {
	Timestamp int64  `json:"timestamp"`
	Action    string `json:"action"` // CREATE, UPDATE, DELETE, etc
	Identity  string `json:"identity"`
	Details   string `json:"details,omitempty"`
}
