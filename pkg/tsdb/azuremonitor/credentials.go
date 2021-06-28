package azuremonitor

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
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
		credentials := getAzureCredentials(cfg, model)
		tokenProvider := aztokenprovider.NewAzureAccessTokenProvider(cfg, credentials, route.Scopes)
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

func getAzureCredentials(cfg *setting.Cfg, model datasourceInfo) azcredentials.AzureCredentials {
	authType := strings.ToLower(model.Settings.AzureAuthType)
	clientId := model.Settings.ClientId

	// Type of authentication being determined by the following logic:
	// * If authType is set to 'msi' then user explicitly selected the managed identity authentication
	// * If authType isn't set but other fields are configured then it's a datasource which was configured
	//   before managed identities where introduced, therefore use client secret authentication
	// * If authType and other fields aren't set then it means the datasource never been configured
	//   and managed identity is the default authentication choice as long as managed identities are enabled
	isManagedIdentity := authType == "msi" || (authType == "" && clientId == "" && cfg.Azure.ManagedIdentityEnabled)

	if isManagedIdentity {
		return &azcredentials.AzureManagedIdentityCredentials{}
	} else {
		return &azcredentials.AzureClientSecretCredentials{
			// TODO: Cloud should be taken from the route definition
			//AzureCloud:   authParams.Params["azure_cloud"],
			AzureCloud: "AzureCloud",
			// TODO: Cloud should be taken from the route definition
			//Authority:    authParams.Url,
			TenantId:     model.Settings.TenantId,
			ClientId:     clientId,
			ClientSecret: model.DecryptedSecureJSONData["clientSecret"],
		}
	}
}
