package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	opentsdb "github.com/grafana/grafana/pkg/tsdb/opentsdb"
)

var (
	_ backend.QueryDataHandler = (*Datasource)(nil)
)

type Datasource struct {
	Service *opentsdb.Service
}

func NewDatasource(context.Context, backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{
		Service: opentsdb.ProvideService(httpclient.NewProvider()),
	}, nil
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return d.Service.QueryData(ctx, req)
}
