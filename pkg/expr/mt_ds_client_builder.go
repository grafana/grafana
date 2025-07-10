package expr

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
)

type MTDatasourceClientBuilder interface {
	BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, error)
}

type nullBuilder struct{}

func (m *nullBuilder) BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, error) {
	return nil, errors.New("mt ds client not available, please use single tenant plugin client")
}

func NewNullMTDatasourceClientBuilder() MTDatasourceClientBuilder {
	return &nullBuilder{}
}

type MtDatasourceClientBuilderWithClientSupplier struct {
	clientSupplier clientapi.DataSourceClientSupplier
	ctx            context.Context
	headers        map[string]string
	instanceConfig clientapi.InstanceConfigurationSettings
}

func (b *MtDatasourceClientBuilderWithClientSupplier) BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, error) {
	return b.clientSupplier.GetDataSourceClient(
		b.ctx,
		v0alpha1.DataSourceRef{
			Type: pluginId,
			UID:  uid,
		},
		b.headers,
		b.instanceConfig,
	)
}

func NewMtDatasourceClientBuilderWithClientSupplier(
	clientSupplier clientapi.DataSourceClientSupplier,
	ctx context.Context,
	headers map[string]string,
	instanceConfig clientapi.InstanceConfigurationSettings,
) *MtDatasourceClientBuilderWithClientSupplier {
	return &MtDatasourceClientBuilderWithClientSupplier{
		clientSupplier: clientSupplier,
		ctx:            ctx,
		headers:        headers,
		instanceConfig: instanceConfig,
	}
}
