package secretkeeper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

// Service is the interface for secret keeper services.
type Service interface {
	GetKeepers() (map[contracts.KeeperType]contracts.Keeper, error)
}

// OSSKeeperService is the OSS implementation of the Service interface.
type OSSKeeperService struct {
	tracer            tracing.Tracer
	encryptionManager *manager.EncryptionManager
	store             encryptionstorage.EncryptedValueStorage
}

func ProvideService(tracer tracing.Tracer, encryptionManager *manager.EncryptionManager, store encryptionstorage.EncryptedValueStorage) (OSSKeeperService, error) {
	return OSSKeeperService{
		tracer:            tracer,
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (ks OSSKeeperService) GetKeepers() (map[contracts.KeeperType]contracts.Keeper, error) {
	sqlKeeper, err := sqlkeeper.NewSQLKeeper(ks.tracer, ks.encryptionManager, ks.store)
	if err != nil {
		return nil, fmt.Errorf("failed to create sql keeper: %w", err)
	}

	return map[contracts.KeeperType]contracts.Keeper{
		contracts.SQLKeeperType: sqlKeeper,
	}, nil
}
