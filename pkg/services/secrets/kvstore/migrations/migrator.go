package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	datasources "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
)

var logger = log.New("secret.migration")

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationServiceImpl struct {
	Services          []SecretMigrationService
	ServerLockService *serverlock.ServerLockService
}

func ProvideSecretMigrationService(
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *datasources.DataSourceSecretMigrationService,
	pluginSecretMigrationService *kvstore.PluginSecretMigrationService,
) *SecretMigrationServiceImpl {
	services := make([]SecretMigrationService, 0)
	services = append(services, dataSourceSecretMigrationService)
	// pluginMigrationService should always be the last one
	services = append(services, pluginSecretMigrationService)

	return &SecretMigrationServiceImpl{
		ServerLockService: serverLockService,
		Services:          services,
	}
}

// Migrate Run migration services. This will block until all services have exited.
func (s *SecretMigrationServiceImpl) Migrate(ctx context.Context) error {
	// Start migration services.
	return s.ServerLockService.LockAndExecute(ctx, "migrate secrets to unified secrets", time.Minute*10, func(context.Context) {
		for _, service := range s.Services {
			serviceName := reflect.TypeOf(service).String()
			logger.Debug("Starting secret migration service", "service", serviceName)
			err := service.Migrate(ctx)
			if err != nil {
				logger.Error("Stopped secret migration service", "service", serviceName, "reason", err)
			}
			logger.Debug("Finished secret migration service", "service", serviceName)
		}
	})
}
