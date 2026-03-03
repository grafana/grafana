package service

import (
	"context"
	"fmt"
	"sync"
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
	// some stats
	consolidateStart := time.Now()
	totalComputeTime := int64(0)
	numberOfBatches := 0
	numberOfValues := 0

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
	workers := 1
	if opts != nil && opts.Workers > 0 {
		workers = opts.Workers
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

	log := logging.FromContext(ctx)
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	var firstErr error
	var firstErrMu sync.Mutex

	finalize := func(ns string, values []*contracts.EncryptedValue) error {
		numberOfBatches++
		numberOfValues += len(values)
		start := time.Now()
		log.Debug("ConsolidationService.Consolidate: finalizing namespace", "namespace", ns, "values", len(values))
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
		log.Debug("ConsolidationService.Consolidate: finalized namespace", "namespace", ns, "values", len(values), "time", time.Since(start))
		totalComputeTime += time.Since(start).Milliseconds()
		return nil
	}

	var currentNamespace string
	var batch []*contracts.EncryptedValue

	launchFinalize := func(ns string, values []*contracts.EncryptedValue) {
		if len(values) == 0 && ns == "" {
			return
		}
		// Copy slice so goroutine sees immutable data
		valuesCopy := make([]*contracts.EncryptedValue, len(values))
		copy(valuesCopy, values)
		wg.Add(1)
		go func(ns string, values []*contracts.EncryptedValue) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if err := finalize(ns, values); err != nil {
				firstErrMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				firstErrMu.Unlock()
			}
		}(ns, valuesCopy)
	}

	for _, ev := range encryptedValues {
		if ev.Namespace != currentNamespace {
			launchFinalize(currentNamespace, batch)
			currentNamespace = ev.Namespace
			batch = nil
		}
		batch = append(batch, ev)
	}
	launchFinalize(currentNamespace, batch)

	wg.Wait()
	if firstErr != nil {
		return firstErr
	}

	// TODO: After all values are re-encrypted, we can safely remove the old data keys.

	log.Debug("ConsolidationService.Consolidate: finished", "duration", time.Since(consolidateStart), "totalComputeTime", totalComputeTime, "numberOfNamespaces", numberOfBatches, "numberOfValues", numberOfValues)
	return nil
}
