package buffered

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/buffered/azureauth"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
	"github.com/grafana/grafana/pkg/util/maputil"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// CreateTransportOptions creates options for the http client. Probably should be shared and should not live in the
// buffered package.
func CreateTransportOptions(settings backend.DataSourceInstanceSettings, cfg *setting.Cfg, logger log.Logger) (*sdkhttpclient.Options, error) {
	opts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")

	opts.Middlewares = middlewares(logger, httpMethod)

	// Set SigV4 service namespace
	if opts.SigV4 != nil {
		opts.SigV4.Service = "aps"
	}

	// Set Azure authentication
	if cfg.AzureAuthEnabled {
		err = azureauth.ConfigureAzureAuthentication(settings, cfg.Azure, &opts)
		if err != nil {
			return nil, fmt.Errorf("error configuring Azure auth: %v", err)
		}
	}

	return &opts, nil
}

func CreateClient(roundTripper http.RoundTripper, url string) (apiv1.API, error) {
	cfg := api.Config{
		Address:      url,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func middlewares(logger log.Logger, httpMethod string) []sdkhttpclient.Middleware {
	middlewares := []sdkhttpclient.Middleware{
		// TODO: probably isn't needed anymore and should by done by http infra code
		middleware.CustomQueryParameters(logger),
		sdkhttpclient.CustomHeadersMiddleware(),
	}

	// Needed to control GET vs POST method of the requests
	if strings.ToLower(httpMethod) == "get" {
		middlewares = append(middlewares, middleware.ForceHttpGet(logger))
	}

	return middlewares
}
