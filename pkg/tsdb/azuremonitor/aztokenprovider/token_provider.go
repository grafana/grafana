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
	tokenRetriever TokenRetriever
}

func NewAzureAccessTokenProvider(cfg *setting.Cfg, credentials azcredentials.AzureCredentials) (AzureTokenProvider, error) {
	if cfg == nil {
		err := fmt.Errorf("parameter 'cfg' cannot be nil")
		return nil, err
	}
	if credentials == nil {
		err := fmt.Errorf("parameter 'credentials' cannot be nil")
		return nil, err
	}

	var tokenRetriever TokenRetriever

	switch c := credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if !cfg.Azure.ManagedIdentityEnabled {
			err := fmt.Errorf("managed identity authentication is not enabled in Grafana config")
			return nil, err
		} else {
			tokenRetriever = getManagedIdentityTokenRetriever(cfg, c)
		}
	case *azcredentials.AzureClientSecretCredentials:
		tokenRetriever = getClientSecretTokenRetriever(c)
	default:
		err := fmt.Errorf("credentials of type '%s' not supported by authentication provider", c.AzureAuthType())
		return nil, err
	}

	tokenProvider := &tokenProviderImpl{
		tokenRetriever: tokenRetriever,
	}

	return tokenProvider, nil
}

func (provider *tokenProviderImpl) GetAccessToken(ctx context.Context, scopes []string) (string, error) {
	if ctx == nil {
		err := fmt.Errorf("parameter 'ctx' cannot be nil")
		return "", err
	}
	if scopes == nil {
		err := fmt.Errorf("parameter 'scopes' cannot be nil")
		return "", err
	}

	accessToken, err := azureTokenCache.GetAccessToken(ctx, provider.tokenRetriever, scopes)
	if err != nil {
		return "", err
	}
	return accessToken, nil
}

func getManagedIdentityTokenRetriever(cfg *setting.Cfg, credentials *azcredentials.AzureManagedIdentityCredentials) TokenRetriever {
	var clientId string
	if credentials.ClientId != "" {
		clientId = credentials.ClientId
	} else {
		clientId = cfg.Azure.ManagedIdentityClientId
	}
	return &managedIdentityTokenRetriever{
		clientId: clientId,
	}
}

func getClientSecretTokenRetriever(credentials *azcredentials.AzureClientSecretCredentials) TokenRetriever {
	var authority string
	if credentials.Authority != "" {
		authority = credentials.Authority
	} else {
		authority = resolveAuthorityForCloud(credentials.AzureCloud)
	}
	return &clientSecretTokenRetriever{
		authority:    authority,
		tenantId:     credentials.TenantId,
		clientId:     credentials.ClientId,
		clientSecret: credentials.ClientSecret,
	}
}

func resolveAuthorityForCloud(cloudName string) string {
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

type managedIdentityTokenRetriever struct {
	clientId   string
	credential azcore.TokenCredential
}

func (c *managedIdentityTokenRetriever) GetCacheKey() string {
	clientId := c.clientId
	if clientId == "" {
		clientId = "system"
	}
	return fmt.Sprintf("azure|msi|%s", clientId)
}

func (c *managedIdentityTokenRetriever) Init() error {
	if credential, err := azidentity.NewManagedIdentityCredential(c.clientId, nil); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *managedIdentityTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, azcore.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

type clientSecretTokenRetriever struct {
	authority    string
	tenantId     string
	clientId     string
	clientSecret string
	credential   azcore.TokenCredential
}

func (c *clientSecretTokenRetriever) GetCacheKey() string {
	return fmt.Sprintf("azure|clientsecret|%s|%s|%s|%s", c.authority, c.tenantId, c.clientId, hashSecret(c.clientSecret))
}

func (c *clientSecretTokenRetriever) Init() error {
	options := &azidentity.ClientSecretCredentialOptions{AuthorityHost: c.authority}
	if credential, err := azidentity.NewClientSecretCredential(c.tenantId, c.clientId, c.clientSecret, options); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *clientSecretTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
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
