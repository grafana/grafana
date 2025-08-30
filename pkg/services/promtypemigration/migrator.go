package promtypemigration

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var logger = log.New("promds.migration")

const actionName = "prom type migration task"

type PromTypeMigrationService interface {
	Migrate(ctx context.Context) error
}

type PromTypeMigrationProvider interface {
	registry.BackgroundService
}

type PromTypeMigrationProviderImpl struct {
	services          []PromTypeMigrationService
	features          featuremgmt.FeatureToggles
	ServerLockService *serverlock.ServerLockService
}

func ProvidePromTypeMigrationProvider(
	serverLockService *serverlock.ServerLockService,
	features featuremgmt.FeatureToggles,
	promAzureAuthMigrationService *AzurePromMigrationService,
	promAmazonAuthMigrationService *AmazonPromMigrationService,
) *PromTypeMigrationProviderImpl {
	return &PromTypeMigrationProviderImpl{
		ServerLockService: serverLockService,
		features:          features,
		services:          []PromTypeMigrationService{promAzureAuthMigrationService, promAmazonAuthMigrationService},
	}
}

func (s *PromTypeMigrationProviderImpl) Run(ctx context.Context) error {
	if !s.features.IsEnabled(ctx, featuremgmt.FlagPrometheusTypeMigration) {
		return nil
	}
	return s.migrate(ctx)
}

// migrate Run migration services. This will block until all services have exited.
// This should only be called once at startup
func (s *PromTypeMigrationProviderImpl) migrate(ctx context.Context) error {
	err := s.ServerLockService.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		for _, service := range s.services {
			serviceName := reflect.TypeOf(service).String()
			logger.Debug("Starting prom data source type migration service", "service", serviceName)
			err := service.Migrate(ctx)
			if err != nil {
				logger.Error("Stopped prom data source type migration service", "service", serviceName, "reason", err)
			}
			logger.Debug("Finished prom data source type migration service", "service", serviceName)
		}
	})
	if err != nil {
		logger.Error("Server lock for prom data source type migration already exists")
	}
	return nil
}
