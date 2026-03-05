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

	oauth2Cfg := getOAuth2ClientCredentialsConfig(jsonData, settings.DecryptedSecureJSONData)
	opts.Middlewares = middlewares(logger, httpMethod, oauth2Cfg)

	return &opts, nil
}

func middlewares(logger log.Logger, httpMethod string, oauth2Cfg *middleware.OAuth2ClientCredentialsConfig) []sdkhttpclient.Middleware {
	mws := []sdkhttpclient.Middleware{
		// TODO: probably isn't needed anymore and should by done by http infra code
		middleware.CustomQueryParameters(logger),
	}

	// Needed to control GET vs POST method of the requests
	if strings.ToLower(httpMethod) == "get" {
		mws = append(mws, middleware.ForceHttpGet(logger))
	}

	// Add OAuth2 client credentials middleware if configured
	if oauth2Cfg != nil {
		mws = append(mws, middleware.OAuth2ClientCredentials(logger, *oauth2Cfg))
	}

	return mws
}

// getOAuth2ClientCredentialsConfig extracts OAuth2 client credentials configuration
// from the datasource JSON data and secure JSON data.
func getOAuth2ClientCredentialsConfig(jsonData map[string]any, secureJSONData map[string]string) *middleware.OAuth2ClientCredentialsConfig {
	oauth2Enabled, _ := maputil.GetBoolOptional(jsonData, "oauth2ClientCredentials")
	if !oauth2Enabled {
		return nil
	}

	clientID, _ := maputil.GetStringOptional(jsonData, "oauth2ClientId")
	tokenURL, _ := maputil.GetStringOptional(jsonData, "oauth2TokenUrl")
	clientSecret := secureJSONData["oauth2ClientSecret"]

	if clientID == "" || clientSecret == "" || tokenURL == "" {
		return nil
	}

	cfg := &middleware.OAuth2ClientCredentialsConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		TokenURL:     tokenURL,
	}

	// Parse scopes from JSON data
	scopesStr, _ := maputil.GetStringOptional(jsonData, "oauth2Scopes")
	if scopesStr != "" {
		scopes := strings.Split(scopesStr, ",")
		for i, s := range scopes {
			scopes[i] = strings.TrimSpace(s)
		}
		cfg.Scopes = scopes
	}

	// Parse endpoint params from JSON data
	endpointParamsStr, _ := maputil.GetStringOptional(jsonData, "oauth2EndpointParams")
	if endpointParamsStr != "" {
		params := make(map[string][]string)
		for _, param := range strings.Split(endpointParamsStr, "&") {
			parts := strings.SplitN(param, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				value := strings.TrimSpace(parts[1])
				params[key] = append(params[key], value)
			}
		}
		if len(params) > 0 {
			cfg.EndpointParams = params
		}
	}

	return cfg
}
