package client

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/util/maputil"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/azureauth"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
)

// CreateTransportOptions creates options for the http client. Probably should be shared and should not live in the
// buffered package.
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

	// Set SigV4 service namespace
	if opts.SigV4 != nil {
		opts.SigV4.Service = "aps"
	}

	audienceOverride := backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("prometheusAzureOverrideAudience")

	azureSettings, err := azsettings.ReadSettings(ctx)
	if err != nil {
		logger.Error("failed to read Azure settings from Grafana", "error", err.Error())
		return nil, fmt.Errorf("failed to read Azure settings from Grafana: %v", err)
	}

	// Set Azure authentication
	if azureSettings.AzureAuthEnabled {
		err = azureauth.ConfigureAzureAuthentication(settings, azureSettings, &opts, audienceOverride, logger)
		if err != nil {
			return nil, fmt.Errorf("error configuring Azure auth: %v", err)
		}
	}

	return &opts, nil
}

func middlewares(logger log.Logger, httpMethod string) []sdkhttpclient.Middleware {
	middlewares := []sdkhttpclient.Middleware{
		// TODO: probably isn't needed anymore and should by done by http infra code
		middleware.CustomQueryParameters(logger),
	}

	// Needed to control GET vs POST method of the requests
	if strings.ToLower(httpMethod) == "get" {
		middlewares = append(middlewares, middleware.ForceHttpGet(logger))
	}

	return middlewares
}
