package permissions

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type mockDatasourcePermissionService struct {
	DsResult  []*models.DataSource
	ErrResult error
}

func (m *mockDatasourcePermissionService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error {
	cmd.Result = m.DsResult
	return m.ErrResult
}

func NewMockDatasourcePermissionService() *mockDatasourcePermissionService {
	return &mockDatasourcePermissionService{}
}
