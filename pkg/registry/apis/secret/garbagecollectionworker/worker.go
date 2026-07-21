package garbagecollectionworker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/semaphore"
)

// Secure values have the `active` flag set to false on creation and deletion.
// The `active` flag is set to true when the creation process succeeds.
// The worker deletes secure values that are inactive because the creation process failed
// or because the secure value has been deleted.
type Worker struct {
	Cfg                        *setting.Cfg
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
	tracer                     trace.Tracer
}

func ProvideWorker(
	cfg *setting.Cfg,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
	tracer trace.Tracer) *Worker {
	return &Worker{
		Cfg:                        cfg,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		tracer:                     tracer,
	}
}

func (w *Worker) Run(ctx context.Context) error {
	if !w.Cfg.SecretsManagement.GCWorkerEnabled {
		return nil
	}

	timer := time.NewTicker(w.Cfg.SecretsManagement.GCWorkerPollInterval)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-timer.C:
			timeoutCtx, cancel := context.WithTimeout(context.Background(), w.Cfg.SecretsManagement.GCWorkerPerSecureValueCleanupTimeout)
			if _, err := w.CleanupInactiveSecureValues(timeoutCtx); err != nil {
				logging.FromContext(timeoutCtx).Error("cleaning up inactive secure values", "error", err)
			}
			cancel()
		}
	}
}

func (w *Worker) CleanupInactiveSecureValues(ctx context.Context) (out []secretv1beta1.SecureValue, err error) {
	ctx, span := w.tracer.Start(ctx, "Worker.CleanupInactiveSecureValues", trace.WithAttributes())
	defer func() {
		if err != nil {
			span.RecordError(err)
		}
		span.End()
	}()

	secureValues, err := w.secureValueMetadataStorage.LeaseInactiveSecureValues(ctx, w.Cfg.SecretsManagement.GCWorkerMaxBatchSize)
	if err != nil {
		return nil, fmt.Errorf("fetching inactive secure values that need to be cleaned up: %w", err)
	}

	if len(secureValues) == 0 {
		return nil, nil
	}

	errs := make([]error, len(secureValues))

	sema := semaphore.NewWeighted(int64(w.Cfg.SecretsManagement.GCWorkerMaxConcurrentCleanups))
	wg := &sync.WaitGroup{}
	wg.Add(len(secureValues))

	for i, sv := range secureValues {
		span.AddEvent("waiting for semaphore")
		if err := sema.Acquire(ctx, 1); err != nil {
			return nil, fmt.Errorf("acquiring semaphore: %w", err)
		}
		span.AddEvent("semaphore acquire")

		go func(i int, sv *secretv1beta1.SecureValue) {
			defer func() {
				sema.Release(1)
				wg.Done()
				span.AddEvent("semaphore released")
			}()

			errs[i] = w.Cleanup(ctx, sv)
		}(i, &sv)
	}

	wg.Wait()

	secureValuesWithError := make([]secretv1beta1.SecureValue, 0)
	for i, sv := range secureValues {
		if errs[i] == nil {
			continue
		}
		secureValuesWithError = append(secureValuesWithError, sv)
	}

	if len(secureValuesWithError) > 0 {
		input := make([]contracts.SecureValueIdentifier, 0, len(secureValuesWithError))
		for _, sv := range secureValuesWithError {
			input = append(input, contracts.SecureValueIdentifier{
				Namespace: xkube.Namespace(sv.Namespace),
				Name:      sv.Name,
				Version:   sv.Status.Version,
			})
		}

		counts, err := w.secureValueMetadataStorage.IncGCAttemptCount(ctx, input)
		if err != nil {
			return secureValues, errors.Join(append(errs, fmt.Errorf("incrementing gc retry count for secure values: %w", err))...)
		}

		if len(counts) > 0 {
			// Delete secure values that exceeed max retries
			deleteInput := make([]contracts.SecureValueIdentifier, 0, len(secureValuesWithError))
			for _, sv := range secureValuesWithError {
				if counts[string(sv.UID)] >= w.Cfg.SecretsManagement.GCWorkerMaxAttemptsPerSecureValue {
					deleteInput = append(deleteInput, contracts.SecureValueIdentifier{
						Namespace: xkube.Namespace(sv.Namespace),
						Name:      sv.Name,
						Version:   sv.Status.Version,
					})
				}
			}

			logging.FromContext(ctx).Error("deleting secure values that gc worker is unable to clean up after retrying", "deleteInput", deleteInput)
			if err := w.secureValueMetadataStorage.Delete(ctx, deleteInput); err != nil {
				return secureValues, errors.Join(append(errs, fmt.Errorf("deleting secure values: %w", err))...)
			}
		}
	}

	return secureValues, errors.Join(errs...)
}

func (w *Worker) Cleanup(ctx context.Context, sv *secretv1beta1.SecureValue) (err error) {
	ctx, span := w.tracer.Start(ctx, "Worker.Cleanup", trace.WithAttributes(
		attribute.String("namespace", sv.Namespace),
		attribute.String("name", sv.Name),
		attribute.Int64("version", sv.Status.Version),
		attribute.Bool("isRef", sv.Spec.Ref != nil),
	))
	defer func() {
		if err != nil {
			span.RecordError(err)
		}
		span.End()
	}()

	keeperCfg, err := w.keeperMetadataStorage.GetKeeperConfig(ctx, sv.Namespace, sv.Status.Keeper, contracts.ReadOpts{ForUpdate: false})
	if err != nil {
		return fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Status.Keeper, err)
	}

	keeper, err := w.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Status.Keeper, err)
	}

	// If the secure value doesn't use a reference, delete the secret
	if sv.Spec.Ref == nil {
		// Keeper deletion is idempotent
		if err := keeper.Delete(ctx, keeperCfg, xkube.Namespace(sv.Namespace), sv.Name, sv.Status.Version); err != nil {
			return fmt.Errorf("deleting secure value from keeper: %w", err)
		}
	}

	// Metadata deletion is not idempotent but not found errors are ignored
	if err := w.secureValueMetadataStorage.Delete(ctx, []contracts.SecureValueIdentifier{{
		Namespace: xkube.Namespace(sv.Namespace), Name: sv.Name, Version: sv.Status.Version,
	}}); err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
		return fmt.Errorf("deleting secure value from metadata storage: %w", err)
	}

	return nil
}
