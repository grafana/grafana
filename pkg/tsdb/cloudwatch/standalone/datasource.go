package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
)

var (
	_ backend.QueryDataHandler    = (*cloudwatch.Service)(nil)
	_ backend.CheckHealthHandler  = (*cloudwatch.Service)(nil)
	_ backend.CallResourceHandler = (*cloudwatch.Service)(nil)
)

func NewDatasource(context.Context, backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return cloudwatch.ProvideService(), nil
}
