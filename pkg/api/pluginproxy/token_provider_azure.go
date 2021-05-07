package pluginproxy

import (
	"context"
	"fmt"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
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
	var credential azcore.TokenCredential
	var err error

	if provider.isManagedIdentityCredential() {
		if !provider.cfg.Azure.ManagedIdentityEnabled {
			err = fmt.Errorf("managed identity authentication not enabled in Grafana config")
		} else {
			credential, err = provider.getManagedIdentityCredential()
		}
	} else {
		credential, err = provider.getClientSecretCredential()
	}

	if err != nil {
		return "", err
	}

	tokenRequestOptions := azcore.TokenRequestOptions{
		Scopes: provider.authParams.Scopes,
	}

	accessToken, err := credential.GetToken(provider.ctx, tokenRequestOptions)

	if err != nil {
		return "", err
	}

	// TODO: Cache token in memory
	return accessToken.Token, nil
}

func (provider *azureAccessTokenProvider) isManagedIdentityCredential() bool {
	authType := strings.ToLower(provider.authParams.Params["azure_auth_type"])
	clientId := provider.authParams.Params["client_id"]

	// TODO: Add explanation of the logic
	return authType == "msi" || (authType == "" && clientId == "")
}

func (provider *azureAccessTokenProvider) getManagedIdentityCredential() (azcore.TokenCredential, error) {
	clientId := provider.cfg.Azure.ManagedIdentityClientId
	// TODO: Review logging configuration
	return azidentity.NewManagedIdentityCredential(clientId, nil)
}

func (provider *azureAccessTokenProvider) getClientSecretCredential() (azcore.TokenCredential, error) {
	tenantId := provider.authParams.Params["tenant_id"]
	clientId := provider.authParams.Params["client_id"]
	clientSecret := provider.authParams.Params["client_secret"]

	// TODO: Set authority from route
	// TODO: Review logging configuration
	return azidentity.NewClientSecretCredential(tenantId, clientId, clientSecret, nil)
}
