package pluginproxy

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"text/template"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/oauth2/google"
)

//ApplyRoute should use the plugin route data to set auth headers and custom headers
func ApplyRoute(ctx context.Context, req *http.Request, proxyPath string, route *plugins.AppPluginRoute, ds *m.DataSource) {
	proxyPath = strings.TrimPrefix(proxyPath, route.Path)

	data := templateData{
		JsonData:       ds.JsonData.Interface().(map[string]interface{}),
		SecureJsonData: ds.SecureJsonData.Decrypt(),
	}

	interpolatedURL, err := interpolateString(route.Url, data)
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

	if err := addHeaders(&req.Header, route, data); err != nil {
		logger.Error("Failed to render plugin headers", "error", err)
	}

	tokenProvider := newAccessTokenProvider(ds, route)

	if route.TokenAuth != nil {
		if token, err := tokenProvider.getAccessToken(data); err != nil {
			logger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	authenticationType := ds.JsonData.Get("authenticationType").MustString("jwt")
	if route.JwtTokenAuth != nil && authenticationType == "jwt" {
		if token, err := tokenProvider.getJwtAccessToken(ctx, data); err != nil {
			logger.Error("Failed to get access token", "error", err)
		} else {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}
	}

	if authenticationType == "gce" {
		tokenSrc, err := google.DefaultTokenSource(ctx, route.JwtTokenAuth.Scopes...)
		if err != nil {
			logger.Error("Failed to get default token from meta data server", "error", err)
		} else {
			token, err := tokenSrc.Token()
			if err != nil {
				logger.Error("Failed to get default access token from meta data server", "error", err)
			} else {
				req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))
			}
		}
	}

	logger.Info("Requesting", "url", req.URL.String())
}

func interpolateString(text string, data templateData) (string, error) {
	t, err := template.New("content").Parse(text)
	if err != nil {
		return "", fmt.Errorf("could not parse template %s", text)
	}

	var contentBuf bytes.Buffer
	err = t.Execute(&contentBuf, data)
	if err != nil {
		return "", fmt.Errorf("failed to execute template %s", text)
	}

	return contentBuf.String(), nil
}

func addHeaders(reqHeaders *http.Header, route *plugins.AppPluginRoute, data templateData) error {
	for _, header := range route.Headers {
		interpolated, err := interpolateString(header.Content, data)
		if err != nil {
			return err
		}
		reqHeaders.Add(header.Name, interpolated)
	}

	return nil
}
