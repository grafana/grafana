package query

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
)

type CommonDataSourceClientSupplier struct {
	Client clientapi.QueryDataClient
}

func (s *CommonDataSourceClientSupplier) GetDataSourceClient(_ context.Context, _ data.DataSourceRef, _ map[string]string) (clientapi.QueryDataClient, error) {
	return s.Client, nil
}
