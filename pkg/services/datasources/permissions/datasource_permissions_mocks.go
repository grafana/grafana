package permissions

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
)

type mockDatasourcePermissionService struct {
	DsResult    []*datasources.DataSource
	DsUidResult []string
	ErrResult   error
}

func (m *mockDatasourcePermissionService) FilterDatasourceUidsBasedOnQueryPermissions(ctx context.Context, user *user.SignedInUser, datasourceUids []string) ([]string, error) {
	return m.DsUidResult, m.ErrResult
}

func (m *mockDatasourcePermissionService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) ([]*datasources.DataSource, error) {
	return m.DsResult, m.ErrResult
}

func NewMockDatasourcePermissionService() *mockDatasourcePermissionService {
	return &mockDatasourcePermissionService{}
}
