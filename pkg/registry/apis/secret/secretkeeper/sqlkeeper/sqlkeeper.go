package sqlkeeper

import (
	"context"
	"fmt"

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
	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef), nil)
	if err != nil {
		return "", fmt.Errorf("unable to encrypt value: %w", err)
	}

	encryptedVal, err := s.store.Create(ctx, encryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to store encrypted value: %w", err)
	}

	return keepertypes.ExternalID(encryptedVal.UID), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	encryptedValue, err := s.store.Get(ctx, externalID.String())
	if err != nil {
		return "", fmt.Errorf("unable to get encrypted value: %w", err)
	}

	exposedBytes, err := s.encryptionManager.Decrypt(ctx, namespace, encryptedValue.EncryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to decrypt value")
	}

	exposedValue := secretv0alpha1.NewExposedSecureValue(string(exposedBytes))
	return exposedValue, nil
}

func (s *SQLKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) error {
	err := s.store.Delete(ctx, externalID.String())
	if err != nil {
		return fmt.Errorf("failed to delete encrypted value: %w", err)
	}
	return nil
}
