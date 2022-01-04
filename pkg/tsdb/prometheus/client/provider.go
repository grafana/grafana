package client

import (
	"strings"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

func Create(url string, httpOpts sdkhttpclient.Options, clientProvider httpclient.Provider, jsonData map[string]interface{}, plog log.Logger) (apiv1.API, error) {
	customParamsMiddleware := middleware.CustomQueryParameters(plog)
	middlewares := []sdkhttpclient.Middleware{customParamsMiddleware}
	if shouldForceGet(jsonData) {
		middlewares = append(middlewares, middleware.ForceHttpGet(plog))
	}
	httpOpts.Middlewares = middlewares

	roundTripper, err := clientProvider.GetTransport(httpOpts)
	if err != nil {
		return nil, err
	}

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

func shouldForceGet(settingsJson map[string]interface{}) bool {
	methodInterface, exists := settingsJson["httpMethod"]
	if !exists {
		return false
	}

	method, ok := methodInterface.(string)
	if !ok {
		return false
	}

	return strings.ToLower(method) == "get"
}
