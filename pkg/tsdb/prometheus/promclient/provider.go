package promclient

import (
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/middleware"
	"github.com/grafana/grafana/pkg/util/maputil"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type Provider struct {
	settings       backend.DataSourceInstanceSettings
	jsonData       map[string]interface{}
	httpMethod     string
	clientProvider httpclient.Provider
	cfg            *setting.Cfg
	features       featuremgmt.FeatureToggles
	log            log.Logger
}

func NewProvider(
	settings backend.DataSourceInstanceSettings,
	jsonData map[string]interface{},
	clientProvider httpclient.Provider,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	log log.Logger,
) *Provider {
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")
	return &Provider{
		settings:       settings,
		jsonData:       jsonData,
		httpMethod:     httpMethod,
		clientProvider: clientProvider,
		cfg:            cfg,
		features:       features,
		log:            log,
	}
}

func (p *Provider) GetClient(headers map[string]string) (apiv1.API, error) {
	opts, err := p.settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	opts.Middlewares = p.middlewares()
	opts.Headers = reqHeaders(headers)

	// Set SigV4 service namespace
	if opts.SigV4 != nil {
		opts.SigV4.Service = "aps"
	}

	// Azure authentication
	err = p.configureAzureAuthentication(&opts)
	if err != nil {
		return nil, err
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
	if strings.ToLower(p.httpMethod) == "get" {
		middlewares = append(middlewares, middleware.ForceHttpGet(p.log))
	}

	return middlewares
}

func reqHeaders(headers map[string]string) map[string]string {
	// copy to avoid changing the original map
	h := make(map[string]string, len(headers))
	for k, v := range headers {
		h[k] = v
	}
	return h
}
