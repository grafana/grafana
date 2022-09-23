package pluginproxy

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type DSInfo struct {
	ID                      int64
	Updated                 time.Time
	JSONData                map[string]interface{}
	DecryptedSecureJSONData map[string]string
}

// ApplyRoute should use the plugin route data to set auth headers and custom headers.
func ApplyRoute(ctx context.Context, req *http.Request, proxyPath string, route *plugins.Route,
	ds DSInfo, cfg *setting.Cfg) {
	proxyPath = strings.TrimPrefix(proxyPath, route.Path)

	data := templateData{
		JsonData:       ds.JSONData,
		SecureJsonData: ds.DecryptedSecureJSONData,
	}

	ctxLogger := logger.FromContext(ctx)

	if len(route.URL) > 0 {
		interpolatedURL, err := interpolateString(route.URL, data)
		if err != nil {
			ctxLogger.Error("Error interpolating proxy url", "error", err)
			return
		}

		routeURL, err := url.Parse(interpolatedURL)
		if err != nil {
			ctxLogger.Error("Error parsing plugin route url", "error", err)
			return
		}

		req.URL.Scheme = routeURL.Scheme
		req.URL.Host = routeURL.Host
		req.Host = routeURL.Host
		req.URL.Path = util.JoinURLFragments(routeURL.Path, proxyPath)
	}

	if err := addQueryString(req, route, data); err != nil {
		ctxLogger.Error("Failed to render plugin URL query string", "error", err)
	}

	if err := addHeaders(&req.Header, route, data); err != nil {
		ctxLogger.Error("Failed to render plugin headers", "error", err)
	}

	if err := setBodyContent(req, route, data); err != nil {
		ctxLogger.Error("Failed to set plugin route body content", "error", err)
	}

	if tokenProvider, err := getTokenProvider(ctx, cfg, ds, route, data); err != nil {
		ctxLogger.Error("Failed to resolve auth token provider", "error", err)
	} else if tokenProvider != nil {
		if token, err := tokenProvider.GetAccessToken(); err != nil {
			ctxLogger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	if cfg.DataProxyLogging {
		ctxLogger.Debug("Requesting", "url", req.URL.String())
	}
}

func getTokenProvider(ctx context.Context, cfg *setting.Cfg, ds DSInfo, pluginRoute *plugins.Route,
	data templateData) (accessTokenProvider, error) {
	authType := pluginRoute.AuthType

	// Plugin can override authentication type specified in route configuration
	if authTypeOverride, ok := ds.JSONData["authenticationType"].(string); ok && authTypeOverride != "" {
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
		return newAzureAccessTokenProvider(ctx, cfg, tokenAuth)

	case "gce":
		if jwtTokenAuth == nil {
			return nil, fmt.Errorf("'jwtTokenAuth' not configured for authentication type '%s'", authType)
		}
		return newGceAccessTokenProvider(ctx, ds, pluginRoute, jwtTokenAuth), nil

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

func interpolateAuthParams(tokenAuth *plugins.JWTTokenAuth, data templateData) (*plugins.JWTTokenAuth, error) {
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

	return &plugins.JWTTokenAuth{
		Url:    interpolatedUrl,
		Scopes: tokenAuth.Scopes,
		Params: interpolatedParams,
	}, nil
}
