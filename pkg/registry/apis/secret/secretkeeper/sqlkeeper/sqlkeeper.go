package sqlkeeper

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	secretStorage "github.com/grafana/grafana/pkg/storage/secret"
)

type SQLKeeper struct {
	encryptionManager *manager.EncryptionManager
	store             secretStorage.EncryptedValueStorage
}

var _ keepertypes.Keeper = (*SQLKeeper)(nil)

func NewSQLKeeper(encryptionManager *manager.EncryptionManager, store secretStorage.EncryptedValueStorage) (*SQLKeeper, error) {
	return &SQLKeeper{
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (keepertypes.ExternalID, error) {
	// TODO: implement me
	return keepertypes.ExternalID("todo-sql-keeper-store"), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	// TODO: implement me
	return secretv0alpha1.NewExposedSecureValue("todo-sql-keeper-exposed"), nil
}

func (s *SQLKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) error {
	// TODO: implement me
	return nil
}
