package pluginproxy

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	azureTokenCache = NewConcurrentTokenCache()
)

type azureAccessTokenProvider struct {
	datasourceId      int64
	datasourceVersion int
	ctx               context.Context
	cfg               *setting.Cfg
	route             *plugins.AppPluginRoute
	authParams        *plugins.JwtTokenAuth
}

func newAzureAccessTokenProvider(ctx context.Context, cfg *setting.Cfg, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *azureAccessTokenProvider {
	return &azureAccessTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		ctx:               ctx,
		cfg:               cfg,
		route:             pluginRoute,
		authParams:        authParams,
	}
}

func (provider *azureAccessTokenProvider) getAccessToken() (string, error) {
	var credential TokenCredential

	if provider.isManagedIdentityCredential() {
		if !provider.cfg.Azure.ManagedIdentityEnabled {
			err := fmt.Errorf("managed identity authentication not enabled in Grafana config")
			return "", err
		} else {
			credential = provider.getManagedIdentityCredential()
		}
	} else {
		credential = provider.getClientSecretCredential()
	}

	accessToken, err := azureTokenCache.GetAccessToken(provider.ctx, credential, provider.authParams.Scopes)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (provider *azureAccessTokenProvider) isManagedIdentityCredential() bool {
	authType := strings.ToLower(provider.authParams.Params["azure_auth_type"])
	clientId := provider.authParams.Params["client_id"]

	// Type of authentication being determined by the following logic:
	// * If authType is set to 'msi' then user explicitly selected the managed identity authentication
	// * If authType isn't set but other fields are configured then it's a datasource which was configured
	//   before managed identities where introduced, therefore use client secret authentication
	// * If authType and other fields aren't set then it means the datasource never been configured
	//   and managed identity is the default authentication choice as long as managed identities are enabled
	return authType == "msi" || (authType == "" && clientId == "" && provider.cfg.Azure.ManagedIdentityEnabled)
}

func (provider *azureAccessTokenProvider) getManagedIdentityCredential() TokenCredential {
	clientId := provider.cfg.Azure.ManagedIdentityClientId

	return &managedIdentityCredential{clientId: clientId}
}

func (provider *azureAccessTokenProvider) getClientSecretCredential() TokenCredential {
	authority := provider.resolveAuthorityHost(provider.authParams.Params["azure_cloud"])
	tenantId := provider.authParams.Params["tenant_id"]
	clientId := provider.authParams.Params["client_id"]
	clientSecret := provider.authParams.Params["client_secret"]

	return &clientSecretCredential{authority: authority, tenantId: tenantId, clientId: clientId, clientSecret: clientSecret}
}

func (provider *azureAccessTokenProvider) resolveAuthorityHost(cloudName string) string {
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
	}
	// Fallback to direct URL
	return provider.authParams.Url
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

func (c *managedIdentityCredential) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	// No need to lock here because the caller is responsible for thread safety
	if c.credential == nil {
		var err error
		c.credential, err = azidentity.NewManagedIdentityCredential(c.clientId, nil)
		if err != nil {
			return nil, err
		}
	}

	// Implementation of ManagedIdentityCredential doesn't support scopes, converting to resource
	if len(scopes) == 0 {
		return nil, errors.New("scopes not provided")
	}
	resource := strings.TrimSuffix(scopes[0], "/.default")
	scopes = []string{resource}

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

func (c *clientSecretCredential) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	// No need to lock here because the caller is responsible for thread safety
	if c.credential == nil {
		var err error
		c.credential, err = azidentity.NewClientSecretCredential(c.tenantId, c.clientId, c.clientSecret, nil)
		if err != nil {
			return nil, err
		}
	}

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
