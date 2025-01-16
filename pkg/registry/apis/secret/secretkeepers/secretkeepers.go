package secretkeepers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeepers/sqlkeeper"
	secretStorage "github.com/grafana/grafana/pkg/storage/secret"
)

type Service interface {
	GetKeeper(ctx context.Context, keeperType secret.KeeperType, payloadConfig string) (secret.Keeper, error)
}

type OSSKeeperService struct {
	encryptionManager *manager.EncryptionManager
	store             secretStorage.EncryptedValueStorage
}

func ProvideService(encryptionManager *manager.EncryptionManager, store secretStorage.EncryptedValueStorage) (OSSKeeperService, error) {
	return OSSKeeperService{
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (ks OSSKeeperService) GetKeeper(ctx context.Context, keeperType secret.KeeperType, payloadConfig string) (secret.Keeper, error) {
	// Default SQL keeper
	if keeperType != secret.SQLKeeperType {
		return nil, fmt.Errorf("missing configuration for keeper type %s", keeperType)
	}
	return sqlkeeper.NewSQLKeeper(ks.encryptionManager, ks.store)
}
