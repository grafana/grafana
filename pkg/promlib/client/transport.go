package client

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/promlib/middleware"
	"github.com/grafana/grafana/pkg/promlib/utils"
)

// CreateTransportOptions creates options for the http client.
func CreateTransportOptions(ctx context.Context, settings backend.DataSourceInstanceSettings, logger log.Logger) (*sdkhttpclient.Options, error) {
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting HTTP options: %w", err)
	}

	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")

	opts.Middlewares = middlewares(logger, httpMethod)

	return &opts, nil
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
