package service

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigrations"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/api"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/metrics"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// CloudMigrationsServiceImpl Define the Service Implementation.
type CloudMigrationsServiceImpl struct {
	log log.Logger
	cfg *setting.Cfg

	sqlStore  db.DB
	features  featuremgmt.FeatureToggles
	dsService datasources.DataSourceService

	api     *api.MigrationAPI
	metrics *metrics.Metrics
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
	prom prometheus.Registerer,
) cloudmigrations.CloudMigrationService {
	if !features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		return &NoopServiceImpl{}
	}

	s := &CloudMigrationsServiceImpl{
		log:       log.New(LogPrefix),
		cfg:       cfg,
		sqlStore:  sqlStore,
		features:  features,
		dsService: dsService,
	}
	s.api = api.RegisterApi(routeRegister, s)

	if m, err := metrics.RegisterMetrics(prom); err != nil {
		s.log.Warn("error registering prom metrics", "error", err.Error())
	} else {
		s.metrics = m
	}

	return s
}

func (cm *CloudMigrationsServiceImpl) MigrateDatasources(ctx context.Context, request *models.MigrateDatasourcesRequest) (*models.MigrateDatasourcesResponse, error) {
	return nil, models.ErrInternalNotImplementedError
}
