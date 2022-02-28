package permissions

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type mockDatasourcePermissionService struct {
	DsResult []*models.DataSource
}

func (m *mockDatasourcePermissionService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error {
	cmd.Result = m.DsResult
	return nil
}

func NewMockDatasourcePermissionService() *mockDatasourcePermissionService {
	return &mockDatasourcePermissionService{}
}
