package aztokenprovider

import (
	"context"
	"crypto/sha256"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

var (
	azureTokenCache = NewConcurrentTokenCache()
)

type AzureTokenProvider interface {
	GetAccessToken(ctx context.Context, scopes []string) (string, error)
}

type tokenProviderImpl struct {
	cfg         *setting.Cfg
	credentials azcredentials.AzureCredentials
}

func NewAzureAccessTokenProvider(cfg *setting.Cfg, credentials azcredentials.AzureCredentials) *tokenProviderImpl {
	return &tokenProviderImpl{
		cfg:         cfg,
		credentials: credentials,
	}
}

func (provider *tokenProviderImpl) GetAccessToken(ctx context.Context, scopes []string) (string, error) {
	var credential TokenCredential

	// TODO: Move to provider initialization and reuse for each GetAccessToken call
	switch c := provider.credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if !provider.cfg.Azure.ManagedIdentityEnabled {
			err := fmt.Errorf("managed identity authentication is not enabled in Grafana config")
			return "", err
		} else {
			credential = provider.getManagedIdentityCredential(c)
		}
	case *azcredentials.AzureClientSecretCredentials:
		credential = provider.getClientSecretCredential(c)
	default:
		err := fmt.Errorf("credentials of type '%s' not supported by authentication provider", c.AzureAuthType())
		return "", err
	}

	accessToken, err := azureTokenCache.GetAccessToken(ctx, credential, scopes)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (provider *tokenProviderImpl) getManagedIdentityCredential(credentials *azcredentials.AzureManagedIdentityCredentials) TokenCredential {
	var clientId string
	if credentials.ClientId != "" {
		clientId = credentials.ClientId
	} else {
		clientId = provider.cfg.Azure.ManagedIdentityClientId
	}
	return &managedIdentityCredential{
		clientId: clientId,
	}
}

func (provider *tokenProviderImpl) getClientSecretCredential(credentials *azcredentials.AzureClientSecretCredentials) TokenCredential {
	var authority string
	if credentials.Authority != "" {
		authority = credentials.Authority
	} else {
		authority = provider.resolveAuthorityForCloud(credentials.AzureCloud)
	}
	return &clientSecretCredential{
		authority:    authority,
		tenantId:     credentials.TenantId,
		clientId:     credentials.ClientId,
		clientSecret: credentials.ClientSecret,
	}
}

func (provider *tokenProviderImpl) resolveAuthorityForCloud(cloudName string) string {
	// Known Azure clouds
	switch cloudName {
	case setting.AzurePublic:
		return azidentity.AzurePublicCloud
	case setting.AzureChina:
		return azidentity.AzureChina
	case setting.AzureUSGovernment:
		return azidentity.AzureGovernment
	case setting.AzureGermany:
		return azidentity.AzureGermany
	default:
		return ""
	}
}

type managedIdentityCredential struct {
	clientId   string
	credential azcore.TokenCredential
}

func (c *managedIdentityCredential) GetCacheKey() string {
	clientId := c.clientId
	if clientId == "" {
		clientId = "system"
	}
	return fmt.Sprintf("azure|msi|%s", clientId)
}

func (c *managedIdentityCredential) Init() error {
	if credential, err := azidentity.NewManagedIdentityCredential(c.clientId, nil); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *managedIdentityCredential) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, azcore.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

type clientSecretCredential struct {
	authority    string
	tenantId     string
	clientId     string
	clientSecret string
	credential   azcore.TokenCredential
}

func (c *clientSecretCredential) GetCacheKey() string {
	return fmt.Sprintf("azure|clientsecret|%s|%s|%s|%s", c.authority, c.tenantId, c.clientId, hashSecret(c.clientSecret))
}

func (c *clientSecretCredential) Init() error {
	options := &azidentity.ClientSecretCredentialOptions{AuthorityHost: c.authority}
	if credential, err := azidentity.NewClientSecretCredential(c.tenantId, c.clientId, c.clientSecret, options); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *clientSecretCredential) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, azcore.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

func hashSecret(secret string) string {
	hash := sha256.New()
	_, _ = hash.Write([]byte(secret))
	return fmt.Sprintf("%x", hash.Sum(nil))
}
