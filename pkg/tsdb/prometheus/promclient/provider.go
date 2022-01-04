package promclient

import (
	"encoding/json"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

const (
	authHeader    = "Authorization"
	idTokenHeader = "X-ID-Token"
)

type Provider struct {
	url            string
	settings       backend.DataSourceInstanceSettings
	clientProvider httpclient.Provider
	log            log.Logger
}

func NewProvider(
	url string,
	settings backend.DataSourceInstanceSettings,
	clientProvider httpclient.Provider,
	log log.Logger,
) *Provider {
	return &Provider{
		url:            url,
		settings:       settings,
		clientProvider: clientProvider,
		log:            log,
	}
}

type jsonSettings struct {
	Method        string `json:"httpMethod"`
	OauthPassThru bool   `json:"oauthPassThru"`
}

func (p *Provider) GetClient(headers map[string]string) (apiv1.API, error) {
	var jsonSettings jsonSettings
	_ = json.Unmarshal(p.settings.JSONData, &jsonSettings) //if there's an error unmarshalling, the 0 value is fine

	opts, err := p.settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	opts.Middlewares = p.middlewares(jsonSettings)
	if jsonSettings.OauthPassThru {
		opts.Headers = authHeaders(headers)
	}

	// Set SigV4 service namespace
	if opts.SigV4 != nil {
		opts.SigV4.Service = "aps"
	}

	roundTripper, err := p.clientProvider.GetTransport(opts)
	if err != nil {
		return nil, err
	}

	cfg := api.Config{
		Address:      p.url,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (p *Provider) middlewares(js jsonSettings) []sdkhttpclient.Middleware {
	middlewares := []sdkhttpclient.Middleware{
		middleware.CustomQueryParameters(p.log),
		sdkhttpclient.CustomHeadersMiddleware(),
	}
	if strings.ToLower(js.Method) == "get" {
		middlewares = append(middlewares, middleware.ForceHttpGet(p.log))
	}

	return middlewares
}

func authHeaders(headers map[string]string) map[string]string {
	authHeaders := make(map[string]string)
	if v, ok := headers[authHeader]; ok {
		authHeaders[authHeader] = v
	}

	if v, ok := headers[idTokenHeader]; ok {
		authHeaders[idTokenHeader] = v
	}

	return authHeaders
}
