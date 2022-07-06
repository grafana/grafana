package migrations

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	datasources "github.com/grafana/grafana/pkg/services/datasources/service"
)

var logger = log.New("secret.migration")

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationServiceImpl struct {
	services          []SecretMigrationService
	serverLockService *serverlock.ServerLockService
}

func ProvideSecretMigrationService(
	serverLockService *serverlock.ServerLockService,
	dataSourceSecretMigrationService *datasources.DataSourceSecretMigrationService,
) *SecretMigrationServiceImpl {
	return &SecretMigrationServiceImpl{
		serverLockService: serverLockService,
		services: []SecretMigrationService{
			dataSourceSecretMigrationService,
		},
	}
}

// Run migration services. This will block until all services have exited.
func (s *SecretMigrationServiceImpl) Migrate(ctx context.Context) error {
	// Start migration services.
	return s.serverLockService.LockAndExecute(ctx, "migrate secrets to unified secrets", time.Minute*10, func(context.Context) {
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
