package pluginproxy

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

// ApplyRoute should use the plugin route data to set auth headers and custom headers.
func ApplyRoute(ctx context.Context, req *http.Request, proxyPath string, route *plugins.AppPluginRoute,
	ds *models.DataSource) {
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

	if tokenProvider := getTokenProvider(ctx, ds, route, data); tokenProvider != nil {
		if token, err := tokenProvider.getAccessToken(); err != nil {
			logger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	logger.Info("Requesting", "url", req.URL.String())
}

func getTokenProvider(ctx context.Context, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	data templateData) accessTokenProvider {
	authenticationType := ds.JsonData.Get("authenticationType").MustString()

	switch authenticationType {
	case "gce":
		return newGceAccessTokenProvider(ctx, ds, pluginRoute)
	case "jwt":
		if pluginRoute.JwtTokenAuth != nil {
			return newJwtAccessTokenProvider(ctx, ds, pluginRoute, data)
		}
	default:
		// Fallback to authentication options when authentication type isn't explicitly configured
		if pluginRoute.TokenAuth != nil {
			return newGenericAccessTokenProvider(ds, pluginRoute, data)
		}
		if pluginRoute.JwtTokenAuth != nil {
			return newJwtAccessTokenProvider(ctx, ds, pluginRoute, data)
		}
	}

	return nil
}
