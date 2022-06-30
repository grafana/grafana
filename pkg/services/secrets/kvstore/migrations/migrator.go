package migrations

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("secret.migration")

// SecretMigrationServiceProvider provides SecretMigration services.
type SecretMigrationServiceProvider interface {
	GetServices() []SecretMigrationService
	Run(context.Context) error
}

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Run(ctx context.Context) error
}

type SecretMigrationServiceProviderImpl struct {
	Services []SecretMigrationService
}

func ProvideSecretMigrationServiceProvider(
	dataSourceSecretMigrationService *DataSourceSecretMigrationService,
) *SecretMigrationServiceProviderImpl {
	return NewSecretMigrationServiceProvider(
		dataSourceSecretMigrationService,
	)
}

func NewSecretMigrationServiceProvider(services ...SecretMigrationService) *SecretMigrationServiceProviderImpl {
	return &SecretMigrationServiceProviderImpl{services}
}

func (r *SecretMigrationServiceProviderImpl) GetServices() []SecretMigrationService {
	return r.Services
}

// Run migration services. This will block until all services have exited.
func (s *SecretMigrationServiceProviderImpl) Run(ctx context.Context) error {
	services := s.Services

	// Start migration services.
	for _, service := range services {
		serviceName := reflect.TypeOf(service).String()
		logger.Debug("Starting secret migration service", "service", serviceName)
		err := service.Run(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("Stopped secret migration service", "service", serviceName, "reason", err)
			return fmt.Errorf("%s run error: %w", serviceName, err)
		}
		logger.Debug("Finished secret migration service", "service", serviceName)
	}
	return nil
}
