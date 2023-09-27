package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("secret.migration")

const actionName = "secret migration task "

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationProvider interface {
	TriggerPluginMigration(ctx context.Context, toPlugin bool) error
}

type SecretMigrationProviderImpl struct {
	migServices              []SecretMigrationService
	ServerLockService        *serverlock.ServerLockService
	migrateToPluginService   *MigrateToPluginService
	migrateFromPluginService *MigrateFromPluginService

	// SecretMigrationProviderImpl is a dskit module Note on dskit module usage:
	// The SecretMigrationProviderImpl iterates over several service's
	// Migration() method sequentially. dskit has the concept of a service
	// Manager which launches services. We could use the Manager here, but it
	// seems heavyweight given that these services only log errors.
	*services.BasicService
}

func ProvideSecretMigrationProvider(
	cfg *setting.Cfg,
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *DataSourceSecretMigrationService,
	migrateToPluginService *MigrateToPluginService,
	migrateFromPluginService *MigrateFromPluginService,
) *SecretMigrationProviderImpl {
	migServices := make([]SecretMigrationService, 0)
	migServices = append(migServices, dataSourceSecretMigrationService)
	// Plugin migration should always be last; should either migrate to or from, not both
	// This is because the migrateTo checks for use_plugin = true, in which case we should always
	// migrate by default to ensure users don't lose access to secrets. If migration has
	// already occurred, the migrateTo function will be called but it won't do anything
	if cfg.SectionWithEnvOverrides("secrets").Key("migrate_from_plugin").MustBool(false) {
		migServices = append(migServices, migrateFromPluginService)
	} else {
		migServices = append(migServices, migrateToPluginService)
	}

	s := &SecretMigrationProviderImpl{
		ServerLockService:        serverLockService,
		migServices:              migServices,
		migrateToPluginService:   migrateToPluginService,
		migrateFromPluginService: migrateFromPluginService,
	}

	s.BasicService = services.NewIdleService(s.start, nil).WithName(modules.SecretMigrator)
	return s
}

func (s *SecretMigrationProviderImpl) start(ctx context.Context) error {
	return s.Migrate(ctx)
}

// Migrate Run migration services. This will block until all services have exited.
// This should only be called once at startup
func (s *SecretMigrationProviderImpl) Migrate(ctx context.Context) error {
	// Start migration services.
	err := s.ServerLockService.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		for _, service := range s.migServices {
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

// TriggerPluginMigration Kick off a migration to or from the plugin. This will block until all services have exited.
func (s *SecretMigrationProviderImpl) TriggerPluginMigration(ctx context.Context, toPlugin bool) error {
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
