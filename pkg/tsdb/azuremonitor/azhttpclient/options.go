package azhttpclient

import (
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azsettings"
)

func AddAzureAuthentication(opts *sdkhttpclient.Options, settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials, scopes []string) {
	opts.Middlewares = append(opts.Middlewares, AzureMiddleware(settings, credentials, scopes))
}
