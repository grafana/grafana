package permissions

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/datasources"
)

var ErrNotImplemented = errors.New("not implemented")

type DatasourcePermissionsService interface {
	FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) error
}

// dummy method
func (hs *OSSDatasourcePermissionsService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) error {
	return ErrNotImplemented
}

type OSSDatasourcePermissionsService struct{}

func ProvideDatasourcePermissionsService() *OSSDatasourcePermissionsService {
	return &OSSDatasourcePermissionsService{}
}
