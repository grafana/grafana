package grafana

import (
	"context"

	"github.com/grafana/pkg/plugins/sdk/genproto/datasource"
)

type grpcClient struct {
	client datasource.DatasourcePluginClient
}

func (m *grpcClient) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	return m.client.Query(ctx, req)
}

type grpcServer struct {
	Impl datasourcePluginWrapper
}

func (m *grpcServer) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	return m.Impl.Query(ctx, req)
}
