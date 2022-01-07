package promclient

import (
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
	settings       backend.DataSourceInstanceSettings
	jsonData       JsonData
	clientProvider httpclient.Provider
	log            log.Logger
}

func NewProvider(
	settings backend.DataSourceInstanceSettings,
	jsonData JsonData,
	clientProvider httpclient.Provider,
	log log.Logger,
) *Provider {
	return &Provider{
		settings:       settings,
		jsonData:       jsonData,
		clientProvider: clientProvider,
		log:            log,
	}
}

type JsonData struct {
	Method        string `json:"httpMethod"`
	OauthPassThru bool   `json:"oauthPassThru"`
	TimeInterval  string `json:"timeInterval"`
}

func (p *Provider) GetClient(headers map[string]string) (apiv1.API, error) {
	opts, err := p.settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	opts.Middlewares = p.middlewares()
	if p.jsonData.OauthPassThru {
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
		Address:      p.settings.URL,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (p *Provider) middlewares() []sdkhttpclient.Middleware {
	middlewares := []sdkhttpclient.Middleware{
		middleware.CustomQueryParameters(p.log),
		sdkhttpclient.CustomHeadersMiddleware(),
	}
	if strings.ToLower(p.jsonData.Method) == "get" {
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
