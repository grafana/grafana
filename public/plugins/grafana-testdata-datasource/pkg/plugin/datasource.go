package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-testdata-datasource/pkg/plugin/testdatasource"
)

var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ backend.StreamHandler         = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

func NewDatasource(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{
		Service: testdatasource.ProvideService(),
	}, nil
}

type Datasource struct {
	Service *testdatasource.Service
}

func (d *Datasource) Dispose() {
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return d.Service.QueryData(ctx, req)
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return d.Service.CallResource(ctx, req, sender)
}

func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return d.Service.CheckHealth(ctx, req)
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
