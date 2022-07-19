package permissions

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var ErrNotImplemented = errors.New("not implemented")

type DsRefAndActions struct {
	DsRef   datasources.DataSourceRef
	Actions []string
}

type DatasourcePermissionsService interface {
	GetAvailableDatasourceActions(ctx context.Context, user *models.SignedInUser, dsRefs []datasources.DataSourceRef) ([]DsRefAndActions, error)
	FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) error
}

// dummy method
func (hs *OSSDatasourcePermissionsService) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *datasources.DatasourcesPermissionFilterQuery) error {
	return ErrNotImplemented
}

// dummy method
func (hs *OSSDatasourcePermissionsService) GetAvailableDatasourceActions(ctx context.Context, user *models.SignedInUser, dsRefs []datasources.DataSourceRef) ([]DsRefAndActions, error) {
	return nil, ErrNotImplemented
}

type OSSDatasourcePermissionsService struct{}

func ProvideDatasourcePermissionsService() *OSSDatasourcePermissionsService {
	return &OSSDatasourcePermissionsService{}
}
