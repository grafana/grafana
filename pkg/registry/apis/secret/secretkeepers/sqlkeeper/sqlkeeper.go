package sqlkeeper

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	secretStorage "github.com/grafana/grafana/pkg/storage/secret"
)

type SQLKeeper struct {
	encryptionManager *manager.EncryptionManager
	store             secretStorage.EncryptedValueStorage
}

var _ secret.Keeper = (*SQLKeeper)(nil)

func NewSQLKeeper(encryptionManager *manager.EncryptionManager, store secretStorage.EncryptedValueStorage) (*SQLKeeper, error) {
	return &SQLKeeper{
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, exposedValueOrRef string) (secret.ExternalID, error) {
	// TODO: implement me
	return secret.ExternalID("todo-sql-keeper-store"), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, id secret.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	// TODO: implement me
	return secretv0alpha1.NewExposedSecureValue("todo-sql-keeper-exposed"), nil
}

func (s *SQLKeeper) Delete(ctx context.Context, id secret.ExternalID) error {
	// TODO: implement me
	return nil
}
