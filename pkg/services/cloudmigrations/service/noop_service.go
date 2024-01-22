package service

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigrations"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
)

// CloudMigrationsServiceImpl Define the Service Implementation.
type NoopServiceImpl struct{}

var _ cloudmigrations.CloudMigrationService = (*NoopServiceImpl)(nil)

func (cm *NoopServiceImpl) MigrateDatasources(ctx context.Context, request *models.MigrateDatasourcesRequest) (*models.MigrateDatasourcesResponse, error) {
	return nil, models.ErrFeatureDisabledError
}
