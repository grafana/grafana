package cloudmonitoring

import (
	"net/http"

	"github.com/grafana/grafana-google-sdk-go/pkg/tokenprovider"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	infrahttp "github.com/grafana/grafana/pkg/infra/httpclient"
)

var cloudMonitoringRoute = struct {
	path   string
	method string
	url    string
	scopes []string
}{
	path:   "cloudmonitoring",
	method: "GET",
	url:    "https://monitoring.googleapis.com",
	scopes: []string{"https://www.googleapis.com/auth/monitoring.read"},
}

func getMiddleware(model *datasourceInfo) (httpclient.Middleware, error) {
	providerConfig := tokenprovider.Config{
		RoutePath:         cloudMonitoringRoute.path,
		RouteMethod:       cloudMonitoringRoute.method,
		DataSourceID:      model.id,
		DataSourceUpdated: model.updated,
		Scopes:            cloudMonitoringRoute.scopes,
	}

	var provider tokenprovider.TokenProvider
	switch model.authenticationType {
	case gceAuthentication:
		provider = tokenprovider.NewGceAccessTokenProvider(providerConfig)
	case jwtAuthentication:
		providerConfig.JwtTokenConfig = &tokenprovider.JwtTokenConfig{
			Email:      model.clientEmail,
			URI:        model.tokenUri,
			PrivateKey: []byte(model.decryptedSecureJSONData["privateKey"]),
		}
		provider = tokenprovider.NewJwtAccessTokenProvider(providerConfig)
	}

	return tokenprovider.AuthMiddleware(provider), nil
}

func newHTTPClient(model *datasourceInfo, opts httpclient.Options, clientProvider infrahttp.Provider) (*http.Client, error) {
	m, err := getMiddleware(model)
	if err != nil {
		return nil, err
	}

	opts.Middlewares = append(opts.Middlewares, m)
	return clientProvider.New(opts)
}
