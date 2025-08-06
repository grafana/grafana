package v1beta1

import "strings"

KeeperSpec: {
	// Short description for the Keeper.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	description: string & strings.MinRunes(1) & strings.MaxRunes(253)

	// AWS Keeper Configuration.
	// +structType=atomic
	// +optional
	aws?: #AWSConfig

	// Azure Keeper Configuration.
	// +structType=atomic
	// +optional
	azure?: #AzureConfig

	// GCP Keeper Configuration.
	// +structType=atomic
	// +optional
	gcp?: #GCPConfig

	// HashiCorp Vault Keeper Configuration.
	// +structType=atomic
	// +optional
	hashiCorpVault?: #HashiCorpConfig
}

#AWSConfig: {
	accessKeyID:     #CredentialValue
	secretAccessKey: #CredentialValue
	kmsKeyID?:       string
}

#AzureConfig: {
	keyVaultName: string
	tenantID:     string
	clientID:     string
	clientSecret: #CredentialValue
}

#GCPConfig: {
	projectID:       string
	credentialsFile: string
}

#HashiCorpConfig: {
	address: string
	token:   #CredentialValue
}

#CredentialValue: {
	// The name of the secure value that holds the actual value.
	// +optional
	secureValueName: string

	// The value is taken from the environment variable.
	// +optional
	valueFromEnv: string

	// The value is taken from the Grafana config file.
	// TODO: how do we explain that this is a path to the config file?
	// +optional
	valueFromConfig: string
}
