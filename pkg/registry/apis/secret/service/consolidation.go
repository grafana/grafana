package service

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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

	// Disable all active data keys so no new data is encrypted with old keys.
	if err = s.globalDataKeyStore.DisableAllDataKeys(ctx); err != nil {
		return fmt.Errorf("disabling all data keys: %w", err)
	}

	// List all encrypted values sorted by namespace; process in place as we see each namespace.
	encryptedValues, err := s.globalEncryptedValueStore.ListAll(ctx, contracts.ListOpts{
		OrderBy: "namespace",
	}, nil)
	if err != nil {
		return fmt.Errorf("listing all encrypted values: %w", err)
	}

	var currentNamespace string
	var batch []*contracts.EncryptedValue

	finalize := func(ns string, values []*contracts.EncryptedValue) error {
		if len(values) == 0 {
			return nil
		}
		nsKey := xkube.Namespace(ns)
		reEncrypted, err := s.encryptionManager.ConsolidateNamespace(ctx, nsKey, values)
		if err != nil {
			return fmt.Errorf("consolidating namespace %s: %w", ns, err)
		}
		for i, payload := range reEncrypted {
			if payload == nil {
				logging.FromContext(ctx).Error("Failed to re-encrypt value", "namespace", values[i].Namespace, "name", values[i].Name, "error", "nil payload")
				continue
			}
			ev := values[i]
			if err = s.encryptedValueStore.Update(ctx, nsKey, ev.Name, ev.Version, *payload); err != nil {
				logging.FromContext(ctx).Error("Failed to update encrypted value", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			}
		}
		return nil
	}

	for _, ev := range encryptedValues {
		if ev.Namespace != currentNamespace {
			if err = finalize(currentNamespace, batch); err != nil {
				return err
			}
			currentNamespace = ev.Namespace
			batch = nil
		}
		batch = append(batch, ev)
	}
	if err = finalize(currentNamespace, batch); err != nil {
		return err
	}

	// TODO: After all values are re-encrypted, we can safely remove the old data keys.

	return nil
}
