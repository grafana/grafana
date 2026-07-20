package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/semaphore"
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

	// Some debug statistics for local testing
	consolidateStart := time.Now()

	var (
		totalComputeTime atomic.Int64
		numberOfBatches  atomic.Int64
		numberOfValues   atomic.Int64
	)

	chunkSize := 100
	if opts != nil && opts.ChunkSize > 0 {
		chunkSize = opts.ChunkSize
	}
	workers := 1
	if opts != nil && opts.Workers > 0 {
		workers = opts.Workers
	}

	// Disable all active data keys so no new data is encrypted with old keys
	if err = s.globalDataKeyStore.DisableAllDataKeys(ctx); err != nil {
		return fmt.Errorf("disabling all data keys: %w", err)
	}

	// List all encrypted values sorted by namespace; process in-place as we see each namespace
	encryptedValues, err := s.globalEncryptedValueStore.ListAll(ctx, contracts.ListOpts{
		OrderBy: "namespace",
	}, nil)
	if err != nil {
		return fmt.Errorf("listing all encrypted values: %w", err)
	}

	log := logging.FromContext(ctx)
	sem := semaphore.NewWeighted(int64(workers))
	var wg sync.WaitGroup
	var firstErr error
	var firstErrMu sync.Mutex

	// Finalize a single namespace by re-encrypting all values with a new data key
	finalizeNamespace := func(ns string, values []*contracts.EncryptedValue) error {
		numberOfBatches.Add(1)
		numberOfValues.Add(int64(len(values)))

		start := time.Now()

		log.Debug("ConsolidationService.Consolidate: finalizing namespace", "namespace", ns, "values", len(values))
		defer func() {
			log.Debug("ConsolidationService.Consolidate: finalized namespace", "namespace", ns, "values", len(values), "time", time.Since(start))
			totalComputeTime.Add(time.Since(start).Milliseconds())
		}()

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

		return nil
	}

	// Launch a goroutine and add to worker pool to finalize a namespace
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
			if err := sem.Acquire(ctx, 1); err != nil {
				firstErrMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				firstErrMu.Unlock()
				return
			}
			defer sem.Release(1)
			if err := finalizeNamespace(ns, values); err != nil {
				firstErrMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				firstErrMu.Unlock()
			}
		}(ns, valuesCopy)
	}

	// Iterate namespace-by-namespace, finalizing the current batch whenever a new one is encountered
	var currentNamespace string
	var currentBatch []*contracts.EncryptedValue

	for _, ev := range encryptedValues {
		if ev.Namespace != currentNamespace {
			launchFinalize(currentNamespace, currentBatch)
			currentNamespace = ev.Namespace
			currentBatch = nil
		}
		currentBatch = append(currentBatch, ev)
	}
	launchFinalize(currentNamespace, currentBatch)

	wg.Wait()
	if firstErr != nil {
		return firstErr
	}

	// TODO: After all values are re-encrypted, we can safely remove the old data keys.

	log.Info("ConsolidationService.Consolidate: finished", "duration", time.Since(consolidateStart), "totalComputeTime", totalComputeTime.Load(), "numberOfNamespaces", numberOfBatches.Load(), "numberOfValues", numberOfValues.Load())
	return nil
}
