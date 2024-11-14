package query

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

// The query runner interface
type DataSourceClientSupplier interface {
	// Get a client for a given datasource
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string) (data.QueryDataClient, error)
}

type CommonDataSourceClientSupplier struct {
	Client data.QueryDataClient
}

func (s *CommonDataSourceClientSupplier) GetDataSourceClient(_ context.Context, _ data.DataSourceRef, _ map[string]string) (data.QueryDataClient, error) {
	return s.Client, nil
}
