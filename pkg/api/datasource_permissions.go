package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type DatasourcePermissionsService interface {
	FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error
}

// dummy method
func (hs *DatasourcePermissionsServiceImpl) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error {
	return nil
}

type DatasourcePermissionsServiceImpl struct{}

func ProvideDatasourcePermissionsService() *DatasourcePermissionsServiceImpl {
	return &DatasourcePermissionsServiceImpl{}
}
