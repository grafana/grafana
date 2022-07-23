package permissions

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
)

type mockDatasourcePermissionService struct {
	DsResult  []*datasources.DataSource
	ErrResult error
}

func (m *mockDatasourcePermissionService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) error {
	cmd.Result = m.DsResult
	return m.ErrResult
}

func NewMockDatasourcePermissionService() *mockDatasourcePermissionService {
	return &mockDatasourcePermissionService{}
}
