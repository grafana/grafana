package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	elasticsearch "github.com/grafana/grafana/pkg/tsdb/elasticsearch"
)

var (
	_ backend.QueryDataHandler    = (*Datasource)(nil)
	_ backend.CheckHealthHandler  = (*Datasource)(nil)
	_ backend.CallResourceHandler = (*Datasource)(nil)
)

func NewDatasource(context.Context, backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{
		Service: elasticsearch.ProvideService(httpclient.NewProvider()),
	}, nil
}

type Datasource struct {
	Service *elasticsearch.Service
}

func contextualMiddlewares(ctx context.Context) context.Context {
	cfg := backend.GrafanaConfigFromContext(ctx)
	responseLimitMiddleware := httpclient.ResponseLimitMiddleware(cfg.ResponseLimit())
	ctx = httpclient.WithContextualMiddleware(ctx, responseLimitMiddleware)
	return ctx
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx = contextualMiddlewares(ctx)
	return d.Service.QueryData(ctx, req)
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = contextualMiddlewares(ctx)
	return d.Service.CallResource(ctx, req, sender)
}

func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = contextualMiddlewares(ctx)
	return d.Service.CheckHealth(ctx, req)
}
