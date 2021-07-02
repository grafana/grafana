package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

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

func httpClientProvider(route azRoute, model datasourceInfo, cfg *setting.Cfg) *httpclient.Provider {
	if len(route.Scopes) > 0 {
		tokenAuth := &plugins.JwtTokenAuth{
			Url:    route.URL,
			Scopes: route.Scopes,
			Params: map[string]string{
				"azure_auth_type": model.Settings.AzureAuthType,
				"azure_cloud":     cfg.Azure.Cloud,
				"tenant_id":       model.Settings.TenantId,
				"client_id":       model.Settings.ClientId,
				"client_secret":   model.DecryptedSecureJSONData["clientSecret"],
			},
		}
		tokenProvider := aztokenprovider.NewAzureAccessTokenProvider(cfg, tokenAuth)
		return httpclient.NewProvider(httpclient.ProviderOptions{
			Middlewares: []httpclient.Middleware{
				aztokenprovider.AuthMiddleware(tokenProvider),
			},
		})
	} else {
		return httpclient.NewProvider()
	}
}

func newHTTPClient(route azRoute, model datasourceInfo, cfg *setting.Cfg) (*http.Client, error) {
	model.HTTPCliOpts.Headers = route.Headers
	return httpClientProvider(route, model, cfg).New(model.HTTPCliOpts)
}
