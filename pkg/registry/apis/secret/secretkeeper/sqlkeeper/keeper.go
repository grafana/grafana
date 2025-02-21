package sqlkeeper

import (
	"context"
	"errors"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

type SQLKeeper struct {
	tracer            tracing.Tracer
	encryptionManager *manager.EncryptionManager
	store             encryptionstorage.EncryptedValueStorage
}

var _ keepertypes.Keeper = (*SQLKeeper)(nil)

func NewSQLKeeper(tracer tracing.Tracer, encryptionManager *manager.EncryptionManager, store encryptionstorage.EncryptedValueStorage) (*SQLKeeper, error) {
	return &SQLKeeper{
		tracer:            tracer,
		encryptionManager: encryptionManager,
		store:             store,
	}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (keepertypes.ExternalID, error) {
	ctx, span := s.tracer.Start(ctx, "sqlKeeper.Store")
	defer span.End()

	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef), encryption.WithoutScope())
	if err != nil {
		return "", fmt.Errorf("unable to encrypt value: %w", err)
	}

	encryptedVal, err := s.store.Create(ctx, namespace, encryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to store encrypted value: %w", err)
	}

	return keepertypes.ExternalID(encryptedVal.UID), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "sqlKeeper.Expose")
	defer span.End()

	encryptedValue, err := s.store.Get(ctx, namespace, externalID.String())
	if err != nil {
		if errors.Is(err, encryptionstorage.ErrEncryptedValueNotFound) {
			return "", keepertypes.ErrSecretNotFound
		}
		return "", fmt.Errorf("unable to get encrypted value: %w", err)
	}

	exposedBytes, err := s.encryptionManager.Decrypt(ctx, namespace, encryptedValue.EncryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to decrypt value: %w", err)
	}

	exposedValue := secretv0alpha1.NewExposedSecureValue(string(exposedBytes))
	return exposedValue, nil
}

func (s *SQLKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) error {
	ctx, span := s.tracer.Start(ctx, "sqlKeeper.Delete")
	defer span.End()

	err := s.store.Delete(ctx, namespace, externalID.String())
	if err != nil {
		return fmt.Errorf("failed to delete encrypted value: %w", err)
	}
	return nil
}

func (s *SQLKeeper) Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID, exposedValueOrRef string) error {
	ctx, span := s.tracer.Start(ctx, "sqlKeeper.Update")
	defer span.End()

	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef), encryption.WithoutScope())
	if err != nil {
		return fmt.Errorf("unable to encrypt value: %w", err)
	}

	err = s.store.Update(ctx, namespace, externalID.String(), encryptedData)
	if err != nil {
		return fmt.Errorf("failed to update encrypted value: %w", err)
	}
	return nil
}
