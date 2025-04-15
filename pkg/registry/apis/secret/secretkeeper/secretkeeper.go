package secretkeeper

import (
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
)

// OSSKeeperService is the OSS implementation of the Service interface.
type OSSKeeperService struct {
	systemKeeper *sqlkeeper.SQLKeeper
}

var _ contracts.KeeperService = (*OSSKeeperService)(nil)

func ProvideService(
	tracer tracing.Tracer,
	store contracts.EncryptedValueStorage,
	encryptionManager contracts.EncryptionManager,
) (*OSSKeeperService, error) {
	// TODO: rename to system keeper or something like that
	systemKeeper, err := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, store)
	if err != nil {
		return nil, fmt.Errorf("failed to create sql keeper: %w", err)
	}

	return &OSSKeeperService{
		systemKeeper: systemKeeper,
	}, nil
}

// Ignore the config, but we could use it to get the keeper type and then return the correct keeper.
// Instantiation only happens on ProvideService ONCE.
func (k *OSSKeeperService) KeeperForConfig(secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
	return k.systemKeeper, nil
}
