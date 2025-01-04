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
	Spec KeeperSpec `json:"spec,omitempty" patchStrategy:"replace" patchMergeKey:"name"`
}

type KeeperSpec struct {
	// Human friendly name for the keeper.
	Title string `json:"title"`

	// You can only chose one of the following.
	SQL       *SQLKeeper       `json:"sql,omitempty"`
	AWS       *AWSKeeper       `json:"aws,omitempty"`
	Azure     *AzureKeeper     `json:"azurekeyvault,omitempty"`
	GCP       *GCPKeeper       `json:"gcp,omitempty"`
	HashiCorp *HashiCorpKeeper `json:"hashivault,omitempty"`
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

// The default SQL keeper.
type SQLKeeper struct {
	Encryption *Encryption `json:"encryption,omitempty"`
}

// Encryption of default SQL keeper.
type Encryption struct {
	Envelope *Envelope `json:"envelope,omitempty"` // TODO: what would this be

	AWS       *AWSCredentials       `json:"aws,omitempty"`
	Azure     *AzureCredentials     `json:"azure,omitempty"`
	GCP       *GCPCredentials       `json:"gcp,omitempty"`
	HashiCorp *HashiCorpCredentials `json:"hashicorp,omitempty"`
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
type CredentialValue struct {
	// The name of the secure value that holds the actual value.
	SecureValueName string `json:"secureValueName,omitempty"`

	// The value is taken from the environment variable.
	ValueFromEnv string `json:"valueFromEnv,omitempty"`

	// The value is taken from the Grafana config file.
	// TODO: how do we explain that this is a path to the config file?
	ValueFromConfig string `json:"valueFromConfig,omitempty"`
}

// Remote Keepers.
type AWSKeeper struct {
	AWSCredentials `json:",inline"`
}

type AzureKeeper struct {
	AzureCredentials `json:",inline"`
}

type GCPKeeper struct {
	GCPCredentials `json:",inline"`
}

type HashiCorpKeeper struct {
	HashiCorpCredentials `json:",inline"`
}
