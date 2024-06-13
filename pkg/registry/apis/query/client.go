package query

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

// The query runner interface
type DataSourceClientSupplier interface {
	// Get a client for a given datasource
	// NOTE: authorization headers are not yet added and the client may be shared across multiple users
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef) (data.QueryDataClient, error)
	// Can be called before GetDataSourceClient to prevent duplicate requests on depedent services in passive mode
	PreprocessRequest(ctx context.Context, ref data.DataSourceRef) (context.Context, error)
}

type CommonDataSourceClientSupplier struct {
	Client data.QueryDataClient
}

func (s *CommonDataSourceClientSupplier) GetDataSourceClient(ctx context.Context, ref data.DataSourceRef) (data.QueryDataClient, error) {
	return s.Client, nil
}

func (s *CommonDataSourceClientSupplier) PreprocessRequest(ctx context.Context, ref data.DataSourceRef) (context.Context, error) {
	return ctx, nil
}
