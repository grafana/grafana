package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	datasources "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
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
	cfg *setting.Cfg,
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *datasources.DataSourceSecretMigrationService,
	migrateToPluginService *kvstore.MigrateToPluginService,
	migrateFromPluginService *kvstore.MigrateFromPluginService,
) *SecretMigrationServiceImpl {
	services := make([]SecretMigrationService, 0)
	services = append(services, dataSourceSecretMigrationService)
	// plugin migration should always be last; should either migrate to or from, not both
	if cfg.SectionWithEnvOverrides("secrets").Key("migrate_from_plugin").MustBool(false) {
		services = append(services, migrateFromPluginService)
	} else {
		services = append(services, migrateToPluginService)
	}

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
