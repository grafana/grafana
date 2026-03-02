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

// namespaceBatch groups encrypted values by namespace. ListAll is ordered by namespace, so a single pass yields contiguous namespace groups.
type namespaceBatch struct {
	namespace string
	values    []*contracts.EncryptedValue
}

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

	// List all encrypted values sorted by namespace so we can process namespace-by-namespace.
	encryptedValues, err := s.globalEncryptedValueStore.ListAll(ctx, contracts.ListOpts{
		OrderBy: "namespace",
	}, nil)
	if err != nil {
		return fmt.Errorf("listing all encrypted values: %w", err)
	}

	batches := s.groupByNamespace(encryptedValues)
	for _, batch := range batches {
		ns := xkube.Namespace(batch.namespace)
		reEncrypted, err := s.encryptionManager.ConsolidateNamespace(ctx, ns, batch.values)
		if err != nil {
			return fmt.Errorf("consolidating namespace %s: %w", batch.namespace, err)
		}

		for i, payload := range reEncrypted {
			if payload == nil {
				continue
			}
			ev := batch.values[i]
			if err = s.encryptedValueStore.Update(ctx, ns, ev.Name, ev.Version, *payload); err != nil {
				logging.FromContext(ctx).Error("Failed to update encrypted value", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			}
		}
	}

	// TODO: After all values are re-encrypted, we can safely remove the old data keys.

	return nil
}

// groupByNamespace returns contiguous namespace batches. encryptedValues must be sorted by namespace.
func (s *ConsolidationService) groupByNamespace(encryptedValues []*contracts.EncryptedValue) []namespaceBatch {
	if len(encryptedValues) == 0 {
		return nil
	}

	var batches []namespaceBatch
	current := namespaceBatch{namespace: encryptedValues[0].Namespace, values: []*contracts.EncryptedValue{encryptedValues[0]}}

	for _, ev := range encryptedValues[1:] {
		if ev.Namespace != current.namespace {
			batches = append(batches, current)
			current = namespaceBatch{namespace: ev.Namespace, values: []*contracts.EncryptedValue{ev}}
		} else {
			current.values = append(current.values, ev)
		}
	}
	batches = append(batches, current)
	return batches
}
