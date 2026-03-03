package service

import (
	"context"
	"fmt"
	"time"

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

func (s *ConsolidationService) Consolidate(ctx context.Context, opts *contracts.ConsolidateOptions) (err error) {
	ctx, span := s.tracer.Start(ctx, "ConsolidationService.Consolidate")
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(otelcodes.Error, err.Error())
			span.RecordError(err)
		}
	}()

	chunkSize := 100
	if opts != nil && opts.ChunkSize > 0 {
		chunkSize = opts.ChunkSize
	}

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
	lastFinalizedTime := time.Now()

	finalize := func(ns string, values []*contracts.EncryptedValue) error {
		fmt.Println("ConsolidationService.Consolidate: finalizing namespace", ns, "values", len(values))
		if len(values) == 0 {
			return nil
		}
		nsKey := xkube.Namespace(ns)
		reEncrypted, err := s.encryptionManager.ConsolidateNamespace(ctx, nsKey, values)
		if err != nil {
			return fmt.Errorf("consolidating namespace %s: %w", ns, err)
		}
		var bulkRows []contracts.BulkUpdateRow
		for i, payload := range reEncrypted {
			if payload == nil {
				logging.FromContext(ctx).Error("Failed to re-encrypt value", "namespace", values[i].Namespace, "name", values[i].Name, "error", "nil payload")
				continue
			}
			ev := values[i]
			bulkRows = append(bulkRows, contracts.BulkUpdateRow{
				Name:    ev.Name,
				Version: ev.Version,
				Payload: *payload,
			})
		}
		if len(bulkRows) > 0 {
			if err = s.encryptedValueStore.UpdateBulk(ctx, nsKey, bulkRows, chunkSize); err != nil {
				return fmt.Errorf("bulk updating namespace %s: %w", ns, err)
			}
		}
		fmt.Println("ConsolidationService.Consolidate: finalized namespace", ns, "values", len(values), "time", time.Since(lastFinalizedTime))
		lastFinalizedTime = time.Now()
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
