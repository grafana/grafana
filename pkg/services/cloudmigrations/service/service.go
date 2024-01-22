package service

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigrations"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/api"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// CloudMigrationsServiceImpl Define the Service Implementation.
type CloudMigrationsServiceImpl struct {
	log log.Logger
	cfg *setting.Cfg

	sqlStore  db.DB
	features  featuremgmt.FeatureToggles
	dsService datasources.DataSourceService

	api *api.MigrationAPI
}

var LogPrefix = "cloudmigrations.service"

var _ cloudmigrations.CloudMigrationService = (*CloudMigrationsServiceImpl)(nil)

// ProvideService Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	sqlStore db.DB,
	dsService datasources.DataSourceService,
	routeRegister routing.RouteRegister,
) cloudmigrations.CloudMigrationService {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}
	}

	service := &CloudMigrationsServiceImpl{
		log:       log.New(LogPrefix),
		cfg:       cfg,
		sqlStore:  sqlStore,
		features:  features,
		dsService: dsService,
	}
	service.api = api.RegisterApi(routeRegister, service)

	return service
}

func (cm *CloudMigrationsServiceImpl) MigrateDatasources(ctx context.Context, request *models.MigrateDatasourcesRequest) (*models.MigrateDatasourcesResponse, error) {
	return nil, models.ErrInternalNotImplementedError
}
