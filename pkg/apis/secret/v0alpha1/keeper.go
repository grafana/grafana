package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Keeper struct {
	metav1.TypeMeta `json:",inline"`

	// Standard object's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// This is the actual keeper schema.
	// +patchStrategy=replace
	// +patchMergeKey=name
	Spec KeeperSpec `json:"spec" patchStrategy:"replace" patchMergeKey:"name"`
}

// KeeperType represents the type of a Keeper.
type KeeperType string

const (
	AWSKeeperType       KeeperType = "aws"
	AzureKeeperType     KeeperType = "azure"
	GCPKeeperType       KeeperType = "gcp"
	HashiCorpKeeperType KeeperType = "hashicorp"
)

func (kt KeeperType) String() string {
	return string(kt)
}

// KeeperConfig is an interface that all keeper config types must implement.
type KeeperConfig interface {
	Type() KeeperType
}

type KeeperSpec struct {
	// Short description for the Keeper.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	Description string `json:"description"`

	// AWS Keeper Configuration.
	// +structType=atomic
	// +optional
	AWS *AWSKeeperConfig `json:"aws,omitempty"`

	// Azure Keeper Configuration.
	// +structType=atomic
	// +optional
	Azure *AzureKeeperConfig `json:"azurekeyvault,omitempty"`

	// GCP Keeper Configuration.
	// +structType=atomic
	// +optional
	GCP *GCPKeeperConfig `json:"gcp,omitempty"`

	// HashiCorp Vault Keeper Configuration.
	// +structType=atomic
	// +optional
	HashiCorp *HashiCorpKeeperConfig `json:"hashivault,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type KeeperList struct {
	metav1.TypeMeta `json:",inline"`

	// Standard list's metadata. It can only be one of `metav1.ObjectMeta` or `metav1.ListMeta`.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	// Slice containing all keepers.
	Items []Keeper `json:"items,omitempty"`
}

// Credentials of remote keepers.
type AWSCredentials struct {
	AccessKeyID     CredentialValue `json:"accessKeyId"`
	SecretAccessKey CredentialValue `json:"secretAccessKey"`
	KMSKeyID        string          `json:"kmsKeyId,omitempty"`
}

type AzureCredentials struct {
	KeyVaultName string          `json:"keyVaultName"`
	TenantID     string          `json:"tenantId"`
	ClientID     string          `json:"clientId"`
	ClientSecret CredentialValue `json:"clientSecret"`
}

type GCPCredentials struct {
	ProjectID       string `json:"projectId"`
	CredentialsFile string `json:"credentialsFile"`
}

type HashiCorpCredentials struct {
	Address string          `json:"address"`
	Token   CredentialValue `json:"token"`
}

// Envelope encrytion details.
type Envelope struct{}

// Holds the way credentials are obtained.
// +union
type CredentialValue struct {
	// The name of the secure value that holds the actual value.
	// +optional
	SecureValueName string `json:"secureValueName,omitempty"`

	// The value is taken from the environment variable.
	// +optional
	ValueFromEnv string `json:"valueFromEnv,omitempty"`

	// The value is taken from the Grafana config file.
	// TODO: how do we explain that this is a path to the config file?
	// +optional
	ValueFromConfig string `json:"valueFromConfig,omitempty"`
}

// Remote Keepers.
type AWSKeeperConfig struct {
	AWSCredentials `json:",inline"`
}

type AzureKeeperConfig struct {
	AzureCredentials `json:",inline"`
}

type GCPKeeperConfig struct {
	GCPCredentials `json:",inline"`
}

type HashiCorpKeeperConfig struct {
	HashiCorpCredentials `json:",inline"`
}

func (s *AWSKeeperConfig) Type() KeeperType {
	return AWSKeeperType
}

func (s *AzureKeeperConfig) Type() KeeperType {
	return AzureKeeperType
}

func (s *GCPKeeperConfig) Type() KeeperType {
	return GCPKeeperType
}

func (s *HashiCorpKeeperConfig) Type() KeeperType {
	return HashiCorpKeeperType
}
