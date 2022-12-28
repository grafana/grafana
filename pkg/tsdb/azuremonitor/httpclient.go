package azuremonitor

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func newHTTPClient(route types.AzRoute, model types.DatasourceInfo, cfg *setting.Cfg, clientProvider httpclient.Provider, httpClientOptions sdkhttpclient.Options) (*http.Client, error) {
	for header, value := range route.Headers {
		httpClientOptions.Headers[header] = value
	}

	// Use Azure credentials if the route has OAuth scopes configured
	if len(route.Scopes) > 0 {
		if cred, ok := model.Credentials.(*azcredentials.AzureClientSecretCredentials); ok && cred.ClientSecret == "" {
			return nil, fmt.Errorf("unable to initialize HTTP Client: clientSecret not found")
		}
		azhttpclient.AddAzureAuthentication(&httpClientOptions, cfg.Azure, model.Credentials, route.Scopes)
	}

	return clientProvider.New(httpClientOptions)
}
