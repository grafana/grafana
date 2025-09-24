package main

import (
	"context"

	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	tempo "github.com/grafana/grafana/pkg/tsdb/tempo"
)

var (
	_ backend.QueryDataHandler    = (*Datasource)(nil)
	_ backend.StreamHandler       = (*Datasource)(nil)
	_ backend.CallResourceHandler = (*Datasource)(nil)
)

type Datasource struct {
	Service *tempo.Service
}

func NewDatasource(c context.Context, b backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{
		Service: tempo.ProvideService(httpclient.NewProvider(), noop.NewTracerProvider().Tracer("tempo")),
	}, nil
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return d.Service.QueryData(ctx, req)
}

func (d *Datasource) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return d.Service.SubscribeStream(ctx, req)
}

func (d *Datasource) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return d.Service.PublishStream(ctx, req)
}

func (d *Datasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return d.Service.RunStream(ctx, req, sender)
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return d.Service.CallResource(ctx, req, sender)
}
