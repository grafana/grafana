package permissions

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
)

var ErrNotImplemented = errors.New("not implemented")

type DatasourcePermissionsService interface {
	FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) ([]*datasources.DataSource, error)
	FilterDatasourceUidsBasedOnQueryPermissions(ctx context.Context, user *user.SignedInUser, datasourceUids []string) ([]string, error)
}

// dummy method
func (hs *OSSDatasourcePermissionsService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) ([]*datasources.DataSource, error) {
	return nil, ErrNotImplemented
}

func (hs *OSSDatasourcePermissionsService) FilterDatasourceUidsBasedOnQueryPermissions(ctx context.Context, user *user.SignedInUser, datasourceUids []string) ([]string, error) {
	return nil, ErrNotImplemented
}

type OSSDatasourcePermissionsService struct{}

func ProvideDatasourcePermissionsService() *OSSDatasourcePermissionsService {
	return &OSSDatasourcePermissionsService{}
}
