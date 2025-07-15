// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type KeeperAWSConfig struct {
	AccessKeyID     KeeperCredentialValue `json:"accessKeyID"`
	SecretAccessKey KeeperCredentialValue `json:"secretAccessKey"`
	KmsKeyID        *string               `json:"kmsKeyID,omitempty"`
}

// NewKeeperAWSConfig creates a new KeeperAWSConfig object.
func NewKeeperAWSConfig() *KeeperAWSConfig {
	return &KeeperAWSConfig{
		AccessKeyID:     *NewKeeperCredentialValue(),
		SecretAccessKey: *NewKeeperCredentialValue(),
	}
}

// +k8s:openapi-gen=true
type KeeperCredentialValue struct {
	// The name of the secure value that holds the actual value.
	// +optional
	SecureValueName string `json:"secureValueName"`
	// The value is taken from the environment variable.
	// +optional
	ValueFromEnv string `json:"valueFromEnv"`
	// The value is taken from the Grafana config file.
	// TODO: how do we explain that this is a path to the config file?
	// +optional
	ValueFromConfig string `json:"valueFromConfig"`
}

// NewKeeperCredentialValue creates a new KeeperCredentialValue object.
func NewKeeperCredentialValue() *KeeperCredentialValue {
	return &KeeperCredentialValue{}
}

// +k8s:openapi-gen=true
type KeeperAzureConfig struct {
	KeyVaultName string                `json:"keyVaultName"`
	TenantID     string                `json:"tenantID"`
	ClientID     string                `json:"clientID"`
	ClientSecret KeeperCredentialValue `json:"clientSecret"`
}

// NewKeeperAzureConfig creates a new KeeperAzureConfig object.
func NewKeeperAzureConfig() *KeeperAzureConfig {
	return &KeeperAzureConfig{
		ClientSecret: *NewKeeperCredentialValue(),
	}
}

// +k8s:openapi-gen=true
type KeeperGCPConfig struct {
	ProjectID       string `json:"projectID"`
	CredentialsFile string `json:"credentialsFile"`
}

// NewKeeperGCPConfig creates a new KeeperGCPConfig object.
func NewKeeperGCPConfig() *KeeperGCPConfig {
	return &KeeperGCPConfig{}
}

// +k8s:openapi-gen=true
type KeeperHashiCorpConfig struct {
	Address string                `json:"address"`
	Token   KeeperCredentialValue `json:"token"`
}

// NewKeeperHashiCorpConfig creates a new KeeperHashiCorpConfig object.
func NewKeeperHashiCorpConfig() *KeeperHashiCorpConfig {
	return &KeeperHashiCorpConfig{
		Token: *NewKeeperCredentialValue(),
	}
}

// +k8s:openapi-gen=true
type KeeperSpec struct {
	// Short description for the Keeper.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	Description string `json:"description"`
	// AWS Keeper Configuration.
	// +structType=atomic
	// +optional
	Aws *KeeperAWSConfig `json:"aws,omitempty"`
	// Azure Keeper Configuration.
	// +structType=atomic
	// +optional
	Azure *KeeperAzureConfig `json:"azure,omitempty"`
	// GCP Keeper Configuration.
	// +structType=atomic
	// +optional
	Gcp *KeeperGCPConfig `json:"gcp,omitempty"`
	// HashiCorp Vault Keeper Configuration.
	// +structType=atomic
	// +optional
	HashiCorpVault *KeeperHashiCorpConfig `json:"hashiCorpVault,omitempty"`
}

// NewKeeperSpec creates a new KeeperSpec object.
func NewKeeperSpec() *KeeperSpec {
	return &KeeperSpec{}
}
