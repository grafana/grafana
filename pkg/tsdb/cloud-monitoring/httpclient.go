package cloudmonitoring

import (
	"net/http"

	"github.com/grafana/grafana-google-sdk-go/pkg/tokenprovider"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	cloudMonitor         = "cloudmonitoring"
	resourceManager      = "cloudresourcemanager"
	cloudMonitorScope    = "https://www.googleapis.com/auth/monitoring.read"
	resourceManagerScope = "https://www.googleapis.com/auth/cloudplatformprojects.readonly"
)

type routeInfo struct {
	method string
	url    string
	scopes []string
}

var routes = map[string]routeInfo{
	cloudMonitor: {
		method: "GET",
		url:    "https://monitoring.googleapis.com",
		scopes: []string{cloudMonitorScope},
	},
	resourceManager: {
		method: "GET",
		url:    "https://cloudresourcemanager.googleapis.com",
		scopes: []string{resourceManagerScope},
	},
}

func getMiddleware(model *datasourceInfo, routePath string) (httpclient.Middleware, error) {
	providerConfig := tokenprovider.Config{
		RoutePath:         routePath,
		RouteMethod:       routes[routePath].method,
		DataSourceID:      model.id,
		DataSourceUpdated: model.updated,
		Scopes:            routes[routePath].scopes,
	}

	var provider tokenprovider.TokenProvider
	switch model.authenticationType {
	case gceAuthentication:
		if model.usingImpersonation {
			providerConfig.TargetPrincipal = model.serviceAccountToImpersonate
			provider = tokenprovider.NewImpersonatedGceAccessTokenProvider(providerConfig)
		} else {
			provider = tokenprovider.NewGceAccessTokenProvider(providerConfig)
		}
	case jwtAuthentication:
		providerConfig.JwtTokenConfig = &tokenprovider.JwtTokenConfig{
			Email:      model.clientEmail,
			URI:        model.tokenUri,
			PrivateKey: []byte(model.privateKey),
		}
		if model.usingImpersonation {
			providerConfig.TargetPrincipal = model.serviceAccountToImpersonate
			provider = tokenprovider.NewImpersonatedJwtAccessTokenProvider(providerConfig)
		} else {
			provider = tokenprovider.NewJwtAccessTokenProvider(providerConfig)
		}
	}

	return tokenprovider.AuthMiddleware(provider), nil
}

func newHTTPClient(model *datasourceInfo, opts httpclient.Options, clientProvider *httpclient.Provider, route string) (*http.Client, error) {
	m, err := getMiddleware(model, route)
	if err != nil {
		return nil, err
	}

	opts.Middlewares = append(opts.Middlewares, m)
	return clientProvider.New(opts)
}
