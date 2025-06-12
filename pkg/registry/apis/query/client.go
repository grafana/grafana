package query

import (
	"context"
	"errors"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
)

type CommonDataSourceClientSupplier struct {
	Client clientapi.QueryDataClient
}

func (s *CommonDataSourceClientSupplier) GetDataSourceClient(_ context.Context, _ data.DataSourceRef, _ map[string]string, _ clientapi.InstanceConfigurationSettings) (clientapi.QueryDataClient, error) {
	return s.Client, nil
}

func (s *CommonDataSourceClientSupplier) GetInstanceConfigurationSettings(_ context.Context) (clientapi.InstanceConfigurationSettings, error) {
	return clientapi.InstanceConfigurationSettings{}, errors.New("get instance configuration settings is not implemented")
}
