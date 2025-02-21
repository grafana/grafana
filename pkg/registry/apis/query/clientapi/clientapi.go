package clientapi

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

type QueryDataClient interface {
	QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error)
}

// The query runner interface
type DataSourceClientSupplier interface {
	// Get a client for a given datasource
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string) (QueryDataClient, error)
}
