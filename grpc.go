package grafana

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
)

type grpcClient struct {
	client datasource.DatasourceServiceClient
}

func (m *grpcClient) Query(ctx context.Context, req *datasource.QueryRequest) (*datasource.QueryResponse, error) {
	return m.client.Query(ctx, req)
}

type grpcServer struct {
	Impl datasourcePluginWrapper
}

func (m *grpcServer) Query(ctx context.Context, req *datasource.QueryRequest) (*datasource.QueryResponse, error) {
	return m.Impl.Query(ctx, req)
}
