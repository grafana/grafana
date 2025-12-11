package secretkeeper

import (
	"fmt"

	"go.opentelemetry.io/otel/trace"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// OSSKeeperService is the OSS implementation of the Service interface.
type OSSKeeperService struct {
	systemKeeper *sqlkeeper.SQLKeeper
}

var _ contracts.KeeperService = (*OSSKeeperService)(nil)

func ProvideService(
	tracer trace.Tracer,
	store contracts.EncryptedValueStorage,
	encryptionManager contracts.EncryptionManager,
	migrationExecutor contracts.EncryptedValueMigrationExecutor,
	reg prometheus.Registerer,
	cfg *setting.Cfg,
	_ *secret.DependencyRegisterer, // noop import so wire runs DB migrations before instantiating this service -- can be nil when manually instantiating
) (*OSSKeeperService, error) {
	systemKeeper, err := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, store, migrationExecutor, reg, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create system keeper: %w", err)
	}

	return &OSSKeeperService{
		systemKeeper: systemKeeper,
	}, nil
}

// Ignore the config, but we could use it to get the keeper type and then return the correct keeper.
// Instantiation only happens on ProvideService ONCE.
func (k *OSSKeeperService) KeeperForConfig(secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
	return k.systemKeeper, nil
}
