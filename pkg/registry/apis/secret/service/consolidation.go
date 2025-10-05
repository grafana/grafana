package service

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ConsolidationService struct {
	tracer                    trace.Tracer
	globalDataKeyStore        contracts.GlobalDataKeyStorage
	encryptedValueStore       contracts.EncryptedValueStorage
	globalEncryptedValueStore contracts.GlobalEncryptedValueStorage
	encryptionManager         contracts.EncryptionManager
}

func ProvideConsolidationService(
	tracer trace.Tracer,
	globalDataKeyStore contracts.GlobalDataKeyStorage,
	encryptedValueStore contracts.EncryptedValueStorage,
	globalEncryptedValueStore contracts.GlobalEncryptedValueStorage,
	encryptionManager contracts.EncryptionManager,
) contracts.ConsolidationService {
	return &ConsolidationService{
		tracer:                    tracer,
		globalDataKeyStore:        globalDataKeyStore,
		encryptedValueStore:       encryptedValueStore,
		globalEncryptedValueStore: globalEncryptedValueStore,
		encryptionManager:         encryptionManager,
	}
}

func (s *ConsolidationService) Consolidate(ctx context.Context) (err error) {
	ctx, span := s.tracer.Start(ctx, "ConsolidationService.Consolidate")
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(otelcodes.Error, err.Error())
			span.RecordError(err)
		}
	}()

	// Disable all active data keys.
	// This will ensure that no new data can be encrypted with the old keys.
	err = s.globalDataKeyStore.DisableAllDataKeys(ctx)
	if err != nil {
		return fmt.Errorf("disabling all data keys: %w", err)
	}

	// List all encrypted values.
	encryptedValues, err := s.globalEncryptedValueStore.ListAll(ctx, contracts.ListOpts{}, nil)
	if err != nil {
		return fmt.Errorf("listing all encrypted values: %w", err)
	}

	for _, ev := range encryptedValues {
		// Decrypt the value using its old data key.
		decryptedValue, err := s.encryptionManager.Decrypt(ctx, ev.Namespace, ev.EncryptedData)
		if err != nil {
			logging.FromContext(ctx).Error("Failed to decrypt value", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			continue
		}

		// Re-encrypt the value using a new data key.
		reEncryptedValue, err := s.encryptionManager.Encrypt(ctx, ev.Namespace, decryptedValue)
		if err != nil {
			logging.FromContext(ctx).Error("Failed to re-encrypt value", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			continue
		}

		// Update the encrypted value in the store.
		err = s.encryptedValueStore.Update(ctx, ev.Namespace, ev.Name, ev.Version, reEncryptedValue)
		if err != nil {
			logging.FromContext(ctx).Error("Failed to update encrypted value", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			continue
		}
	}

	// TODO: After all values are re-encrypted, we can safely remove the old data keys.

	return nil
}
