package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/tokenprovider"
)

// TODO: Remove?
// const (
// 	AzureAuthManagedIdentity = "msi"
// 	AzureAuthClientSecret    = "clientsecret"
// )

// Azure cloud names specific to Azure Monitor
const (
	azureMonitorPublic       = "azuremonitor"
	azureMonitorChina        = "chinaazuremonitor"
	azureMonitorUSGovernment = "govazuremonitor"
	azureMonitorGermany      = "germanyazuremonitor"
)

// Azure cloud query types
const (
	azureMonitor       = "Azure Monitor"
	appInsights        = "Application Insights"
	azureLogAnalytics  = "Azure Log Analytics"
	insightsAnalytics  = "Insights Analytics"
	azureResourceGraph = "Azure Resource Graph"
)

func newHTTPClient(route azRoute, model datasourceInfo, cfg *setting.Cfg, settings backend.DataSourceInstanceSettings) (*http.Client, error) {
	tokenAuth := &plugins.JwtTokenAuth{
		Url:    route.url,
		Scopes: route.scopes,
		Params: map[string]string{
			"azure_auth_type": model.Settings.AzureAuthType,
			"azure_cloud":     cfg.Azure.Cloud,
			"tenant_id":       model.Settings.TenantId,
			"client_id":       model.Settings.ClientId,
			"client_secret":   settings.DecryptedSecureJSONData["clientSecret"],
		},
	}

	tokenProvider := tokenprovider.NewAzureAccessTokenProvider(cfg, tokenAuth)

	httpClientProvider := httpclient.NewProvider(httpclient.ProviderOptions{
		Middlewares: []httpclient.Middleware{
			tokenprovider.AuthMiddleware(tokenProvider),
		},
	})

	opts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}
	opts.Headers = route.headers

	return httpClientProvider.New(opts)
}
