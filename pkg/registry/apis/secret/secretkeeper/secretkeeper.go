package secretkeeper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	secretstorage "github.com/grafana/grafana/pkg/storage/secret"
)

type Service interface {
	GetKeepers() (map[keepertypes.KeeperType]keepertypes.Keeper, error)
}

type OSSKeeperService struct {
	tracer            tracing.Tracer
	encryptionManager *manager.EncryptionManager
	store             secretstorage.EncryptedValueStorage
}

func ProvideService(encryptionManager *manager.EncryptionManager, store secretstorage.EncryptedValueStorage) (OSSKeeperService, error) {
	return OSSKeeperService{
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (ks OSSKeeperService) GetKeepers() (map[keepertypes.KeeperType]keepertypes.Keeper, error) {
	sqlKeeper, err := sqlkeeper.NewSQLKeeper(ks.tracer, ks.encryptionManager, ks.store)
	if err != nil {
		return nil, fmt.Errorf("failed to create sql keeper: %w", err)
	}

	return map[keepertypes.KeeperType]keepertypes.Keeper{
		keepertypes.SQLKeeperType: sqlKeeper,
	}, nil
}
