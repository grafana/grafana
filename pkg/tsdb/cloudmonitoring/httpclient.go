package cloudmonitoring

import (
	"net/http"

	"github.com/grafana/grafana-google-sdk-go/pkg/tokenprovider"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	infrahttp "github.com/grafana/grafana/pkg/infra/httpclient"
)

type jwtParams struct {
	email      string
	uri        string
	privateKey string
}

var cloudMonitoringRoute = struct {
	path   string
	method string
	url    string
	scopes []string
	params jwtParams
}{
	path:   "cloudmonitoring",
	method: "GET",
	url:    "https://monitoring.googleapis.com",
	scopes: []string{"https://www.googleapis.com/auth/monitoring.read"},
	params: jwtParams{
		uri:        "{{.JsonData.tokenUri}}",
		email:      "{{.JsonData.clientEmail}}",
		privateKey: "{{.SecureJsonData.privateKey}}",
	},
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
		data := templateData{
			JsonData:       model.jsonData,
			SecureJsonData: model.decryptedSecureJSONData,
		}

		jwtConf, err := interpolateAuthParams(cloudMonitoringRoute.params, data)
		if err != nil {
			return nil, err
		}
		providerConfig.JwtTokenConfig = jwtConf

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

func interpolateAuthParams(params jwtParams, data templateData) (*tokenprovider.JwtTokenConfig, error) {
	var err error
	config := &tokenprovider.JwtTokenConfig{}
	config.URI, err = interpolateString(params.uri, data)
	if err != nil {
		return nil, err
	}
	config.Email, err = interpolateString(params.email, data)
	if err != nil {
		return nil, err
	}
	privateKey, err := interpolateString(params.privateKey, data)
	if err != nil {
		return nil, err
	}
	config.PrivateKey = []byte(privateKey)

	return config, nil
}
