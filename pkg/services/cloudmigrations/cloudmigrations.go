package cloudmigrations

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
)

type CloudMigrationService interface {
	MigrateDatasources(ctx context.Context, request *models.MigrateDatasourcesRequest) (*models.MigrateDatasourcesResponse, error)
}
