package azuremonitor

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func newHTTPClient(route types.AzRoute, model types.DatasourceInfo, settings *backend.DataSourceInstanceSettings, cfg *setting.Cfg, clientProvider httpclient.Provider) (*http.Client, error) {
	clientOpts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, fmt.Errorf("error getting HTTP options: %w", err)
	}

	for header, value := range route.Headers {
		clientOpts.Headers[header] = value
	}

	// Use Azure credentials if the route has OAuth scopes configured
	if len(route.Scopes) > 0 {
		if cred, ok := model.Credentials.(*azcredentials.AzureClientSecretCredentials); ok && cred.ClientSecret == "" {
			return nil, fmt.Errorf("unable to initialize HTTP Client: clientSecret not found")
		}

		authOpts := azhttpclient.NewAuthOptions(cfg.Azure)
		authOpts.Scopes(route.Scopes)
		azhttpclient.AddAzureAuthentication(&clientOpts, authOpts, model.Credentials)
	}

	return clientProvider.New(clientOpts)
}
