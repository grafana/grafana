package migrations

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("secret.migration")

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}

type SecretMigrationServiceImpl struct {
	Services []SecretMigrationService
}

func ProvideSecretMigrationService(
	dataSourceSecretMigrationService *DataSourceSecretMigrationService,
) *SecretMigrationServiceImpl {
	return NewSecretMigrationService(
		dataSourceSecretMigrationService,
	)
}

func NewSecretMigrationService(services ...SecretMigrationService) *SecretMigrationServiceImpl {
	return &SecretMigrationServiceImpl{services}
}

// Run migration services. This will block until all services have exited.
func (s *SecretMigrationServiceImpl) Migrate(ctx context.Context) error {
	services := s.Services

	// Start migration services.
	for _, service := range services {
		serviceName := reflect.TypeOf(service).String()
		logger.Debug("Starting secret migration service", "service", serviceName)
		err := service.Migrate(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("Stopped secret migration service", "service", serviceName, "reason", err)
			return fmt.Errorf("%s run error: %w", serviceName, err)
		}
		logger.Debug("Finished secret migration service", "service", serviceName)
	}
	return nil
}
