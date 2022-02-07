package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type DatasourcePermissionService interface {
	FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error
}

// dummy method
func (hs *DatasourcePermissionServiceImpl) FilterDatasourcesBasedOnQueryPermissions(ctx context.Context, cmd *models.DatasourcesPermissionFilterQuery) error {
	return nil
}

type DatasourcePermissionServiceImpl struct{}

func ProvideDatasourcePermissionService() *DatasourcePermissionServiceImpl {
	return &DatasourcePermissionServiceImpl{}
}
