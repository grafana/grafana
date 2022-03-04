package azhttpclient

import (
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

func AddAzureAuthentication(opts *sdkhttpclient.Options, cfg *setting.Cfg, credentials azcredentials.AzureCredentials, scopes []string) {
	opts.Middlewares = append(opts.Middlewares, AzureMiddleware(cfg, credentials, scopes))
}
