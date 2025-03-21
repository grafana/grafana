package secretkeeper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
)

// Service is the interface for secret keeper services.
// This exists because OSS and Enterprise have different amounts of keepers available.
type Service interface {
	GetKeepers() (map[contracts.KeeperType]contracts.Keeper, error)
}

// OSSKeeperService is the OSS implementation of the Service interface.
type OSSKeeperService struct {
	tracer            tracing.Tracer
	encryptionManager contracts.EncryptionManager
	store             contracts.EncryptedValueStorage
}

func ProvideService(
	tracer tracing.Tracer,
	store contracts.EncryptedValueStorage,
	encryptionManager contracts.EncryptionManager,
) (OSSKeeperService, error) {
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
