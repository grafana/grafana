package azcredentials

const (
	AzureAuthManagedIdentity = "msi"
	AzureAuthClientSecret    = "clientsecret"
)

type AzureCredentials interface {
	AzureAuthType() string
}

type AzureManagedIdentityCredentials struct {
	ClientId string
}

type AzureClientSecretCredentials struct {
	AzureCloud   string
	Authority    string
	TenantId     string
	ClientId     string
	ClientSecret string
}

func (credentials *AzureManagedIdentityCredentials) AzureAuthType() string {
	return AzureAuthManagedIdentity
}

func (credentials *AzureClientSecretCredentials) AzureAuthType() string {
	return AzureAuthClientSecret
}
