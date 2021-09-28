package azcredentials

const (
	AzureAuthManagedIdentity = "msi"
	AzureAuthClientSecret    = "clientsecret"
	AzureAuthUserIdentity    = "userid"
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

type AzureUserIdentityCredentials struct {
}

func (credentials *AzureManagedIdentityCredentials) AzureAuthType() string {
	return AzureAuthManagedIdentity
}

func (credentials *AzureClientSecretCredentials) AzureAuthType() string {
	return AzureAuthClientSecret
}

func (credentials *AzureUserIdentityCredentials) AzureAuthType() string {
	return AzureAuthUserIdentity
}
