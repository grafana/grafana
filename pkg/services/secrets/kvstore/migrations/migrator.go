package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/registry"
)

var logger = log.New("secret.migration")

const actionName = "secret migration task "

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationProvider interface {
	registry.BackgroundService
}

type SecretMigrationProviderImpl struct {
	services          []SecretMigrationService
	ServerLockService *serverlock.ServerLockService
}

func ProvideSecretMigrationProvider(
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *DataSourceSecretMigrationService,
) *SecretMigrationProviderImpl {
	return &SecretMigrationProviderImpl{
		ServerLockService: serverLockService,
		services:          []SecretMigrationService{dataSourceSecretMigrationService},
	}
}

func (s *SecretMigrationProviderImpl) Run(ctx context.Context) error {
	return s.Migrate(ctx)
}

// Migrate Run migration services. This will block until all services have exited.
// This should only be called once at startup
func (s *SecretMigrationProviderImpl) Migrate(ctx context.Context) error {
	// Start migration services.
	err := s.ServerLockService.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		for _, service := range s.services {
			serviceName := reflect.TypeOf(service).String()
			logger.Debug("Starting secret migration service", "service", serviceName)
			err := service.Migrate(ctx)
			if err != nil {
				logger.Error("Stopped secret migration service", "service", serviceName, "reason", err)
			}
			logger.Debug("Finished secret migration service", "service", serviceName)
		}
	})
	if err != nil {
		logger.Error("Server lock for secret migration already exists")
	}
	return nil
}
