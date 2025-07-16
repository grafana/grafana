package secretkeeper

import (
	"go.opentelemetry.io/otel/trace"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
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
	reg prometheus.Registerer,
) (*OSSKeeperService, error) {
	return &OSSKeeperService{
		// TODO: rename to system keeper or something like that
		systemKeeper: sqlkeeper.NewSQLKeeper(tracer, encryptionManager, store, reg),
	}, nil
}

// Ignore the config, but we could use it to get the keeper type and then return the correct keeper.
// Instantiation only happens on ProvideService ONCE.
func (k *OSSKeeperService) KeeperForConfig(secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
	return k.systemKeeper, nil
}
