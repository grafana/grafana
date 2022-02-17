package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type mockDatasourcePermissionService struct {
	dsResult []*models.DataSource
}

func (m *mockDatasourcePermissionService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error {
	cmd.Result = m.dsResult
	return nil
}

func newMockDatasourcePermissionService() *mockDatasourcePermissionService {
	return &mockDatasourcePermissionService{}
}
