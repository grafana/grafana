package mtdsclient

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
)

type MTDatasourceClientBuilder interface {
	BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, bool)
}

type nullBuilder struct{}

func (m *nullBuilder) BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, bool) {
	return nil, false
}

// we use this noop for st flows
func NewNullMTDatasourceClientBuilder() MTDatasourceClientBuilder {
	return &nullBuilder{}
}

type MtDatasourceClientBuilderWithClientSupplier struct {
	clientSupplier clientapi.DataSourceClientSupplier
	ctx            context.Context
	headers        map[string]string
	instanceConfig clientapi.InstanceConfigurationSettings
	logger         log.Logger
}

func (b *MtDatasourceClientBuilderWithClientSupplier) BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, bool) {
	dsClient, err := b.clientSupplier.GetDataSourceClient(
		b.ctx,
		v0alpha1.DataSourceRef{
			Type: pluginId,
			UID:  uid,
		},
		b.headers,
		b.instanceConfig,
	)
	if err != nil {
		b.logger.Debug("failed to get mt ds client", "error", err)
		return nil, false
	}
	return dsClient, true
}

// TODO: I think we might be able to refactor this to just use the client supplier directly
func NewMtDatasourceClientBuilderWithClientSupplier(
	clientSupplier clientapi.DataSourceClientSupplier,
	ctx context.Context,
	headers map[string]string,
	instanceConfig clientapi.InstanceConfigurationSettings,
	logger log.Logger,
) MTDatasourceClientBuilder {
	return &MtDatasourceClientBuilderWithClientSupplier{
		clientSupplier: clientSupplier,
		ctx:            ctx,
		headers:        headers,
		instanceConfig: instanceConfig,
		logger:         logger,
	}
}

func NewTestMTDSClientBuilder(isMultiTenant bool, mockClient clientapi.QueryDataClient) MTDatasourceClientBuilder {
	return &testBuilder{
		mockClient:    mockClient,
		isMultitenant: isMultiTenant,
	}
}

type testBuilder struct {
	mockClient    clientapi.QueryDataClient
	isMultitenant bool
}

func (b *testBuilder) BuildClient(pluginId string, uid string) (clientapi.QueryDataClient, bool) {
	if !b.isMultitenant {
		return nil, false
	}

	return b.mockClient, true
}
