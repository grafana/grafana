package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("secret.migration")

const actionName = "secret migration task "

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationServiceImpl struct {
	services                 []SecretMigrationService
	ServerLockService        *serverlock.ServerLockService
	migrateToPluginService   *MigrateToPluginService
	migrateFromPluginService *MigrateFromPluginService
}

func ProvideSecretMigrationService(
	cfg *setting.Cfg,
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *DataSourceSecretMigrationService,
	migrateToPluginService *MigrateToPluginService,
	migrateFromPluginService *MigrateFromPluginService,
) *SecretMigrationServiceImpl {
	services := make([]SecretMigrationService, 0)
	services = append(services, dataSourceSecretMigrationService)
	// Plugin migration should always be last; should either migrate to or from, not both
	// This is because the migrateTo checks for use_plugin = true, in which case we should always
	// migrate by default to ensure users don't lose access to secrets. If migration has
	// already occurred, the migrateTo function will be called but it won't do anything
	if cfg.SectionWithEnvOverrides("secrets").Key("migrate_from_plugin").MustBool(false) {
		services = append(services, migrateFromPluginService)
	} else {
		services = append(services, migrateToPluginService)
	}

	return &SecretMigrationServiceImpl{
		ServerLockService:        serverLockService,
		services:                 services,
		migrateToPluginService:   migrateToPluginService,
		migrateFromPluginService: migrateFromPluginService,
	}
}

// Migrate Run migration services. This will block until all services have exited.
// This should only be called once at startup
func (s *SecretMigrationServiceImpl) Migrate(ctx context.Context) error {
	// Start migration services.
	return s.ServerLockService.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
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
}

// TriggerPluginMigration Kick off a migration to or from the plugin. This will block until all services have exited.
func (s *SecretMigrationServiceImpl) TriggerPluginMigration(ctx context.Context, toPlugin bool) error {
	// Don't migrate if there is already one happening
	return s.ServerLockService.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		var err error
		if toPlugin {
			err = s.migrateToPluginService.Migrate(ctx)
		} else {
			err = s.migrateFromPluginService.Migrate(ctx)
		}
		if err != nil {
			direction := "from_plugin"
			if toPlugin {
				direction = "to_plugin"
			}
			logger.Error("Failed to migrate plugin secrets", "direction", direction, "error", err.Error())
		}
	})
}
