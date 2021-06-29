package pluginproxy

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// ApplyRoute should use the plugin route data to set auth headers and custom headers.
func ApplyRoute(ctx context.Context, req *http.Request, proxyPath string, route *plugins.AppPluginRoute,
	ds *models.DataSource, cfg *setting.Cfg) {
	proxyPath = strings.TrimPrefix(proxyPath, route.Path)

	data := templateData{
		JsonData:       ds.JsonData.Interface().(map[string]interface{}),
		SecureJsonData: ds.SecureJsonData.Decrypt(),
	}

	if len(route.URL) > 0 {
		interpolatedURL, err := interpolateString(route.URL, data)
		if err != nil {
			logger.Error("Error interpolating proxy url", "error", err)
			return
		}

		routeURL, err := url.Parse(interpolatedURL)
		if err != nil {
			logger.Error("Error parsing plugin route url", "error", err)
			return
		}

		req.URL.Scheme = routeURL.Scheme
		req.URL.Host = routeURL.Host
		req.Host = routeURL.Host
		req.URL.Path = util.JoinURLFragments(routeURL.Path, proxyPath)
	}

	if err := addQueryString(req, route, data); err != nil {
		logger.Error("Failed to render plugin URL query string", "error", err)
	}

	if err := addHeaders(&req.Header, route, data); err != nil {
		logger.Error("Failed to render plugin headers", "error", err)
	}

	if err := setBodyContent(req, route, data); err != nil {
		logger.Error("Failed to set plugin route body content", "error", err)
	}

	if tokenProvider, err := getTokenProvider(ctx, cfg, ds, route, data); err != nil {
		logger.Error("Failed to resolve auth token provider", "error", err)
	} else if tokenProvider != nil {
		if token, err := tokenProvider.GetAccessToken(); err != nil {
			logger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	if setting.DataProxyLogging {
		logger.Debug("Requesting", "url", req.URL.String())
	}
}

func getTokenProvider(ctx context.Context, cfg *setting.Cfg, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	data templateData) (accessTokenProvider, error) {
	authType := pluginRoute.AuthType

	// Plugin can override authentication type specified in route configuration
	if authTypeOverride := ds.JsonData.Get("authenticationType").MustString(); authTypeOverride != "" {
		authType = authTypeOverride
	}

	tokenAuth, err := interpolateAuthParams(pluginRoute.TokenAuth, data)
	if err != nil {
		return nil, err
	}
	jwtTokenAuth, err := interpolateAuthParams(pluginRoute.JwtTokenAuth, data)
	if err != nil {
		return nil, err
	}

	switch authType {
	case "azure":
		if tokenAuth == nil {
			return nil, fmt.Errorf("'tokenAuth' not configured for authentication type '%s'", authType)
		}
		provider := newAzureAccessTokenProvider(ctx, cfg, tokenAuth)
		return provider, nil

	case "gce":
		if jwtTokenAuth == nil {
			return nil, fmt.Errorf("'jwtTokenAuth' not configured for authentication type '%s'", authType)
		}
		provider := newGceAccessTokenProvider(ctx, ds, pluginRoute, jwtTokenAuth)
		return provider, nil

	case "jwt":
		if jwtTokenAuth == nil {
			return nil, fmt.Errorf("'jwtTokenAuth' not configured for authentication type '%s'", authType)
		}
		provider := newJwtAccessTokenProvider(ctx, ds, pluginRoute, jwtTokenAuth)
		return provider, nil

	case "":
		// Fallback to authentication methods when authentication type isn't explicitly configured
		if tokenAuth != nil {
			provider := newGenericAccessTokenProvider(ds, pluginRoute, tokenAuth)
			return provider, nil
		}
		if jwtTokenAuth != nil {
			provider := newJwtAccessTokenProvider(ctx, ds, pluginRoute, jwtTokenAuth)
			return provider, nil
		}

		// No authentication
		return nil, nil

	default:
		return nil, fmt.Errorf("authentication type '%s' not supported", authType)
	}
}

func interpolateAuthParams(tokenAuth *plugins.JwtTokenAuth, data templateData) (*plugins.JwtTokenAuth, error) {
	if tokenAuth == nil {
		// Nothing to interpolate
		return nil, nil
	}

	interpolatedUrl, err := interpolateString(tokenAuth.Url, data)
	if err != nil {
		return nil, err
	}

	interpolatedParams := make(map[string]string)
	for key, value := range tokenAuth.Params {
		interpolatedParam, err := interpolateString(value, data)
		if err != nil {
			return nil, err
		}
		interpolatedParams[key] = interpolatedParam
	}

	return &plugins.JwtTokenAuth{
		Url:    interpolatedUrl,
		Scopes: tokenAuth.Scopes,
		Params: interpolatedParams,
	}, nil
}
