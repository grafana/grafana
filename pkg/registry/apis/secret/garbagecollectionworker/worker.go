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
}

func ProvideWorker(
	cfg *setting.Cfg,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService) *Worker {
	return &Worker{
		Cfg:                        cfg,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService}
}

func (w *Worker) Run(ctx context.Context) error {
	if !w.Cfg.SecretsManagement.GCWorkerEnabled {
		return nil
	}

	timer := time.NewTicker(w.Cfg.SecretsManagement.GCWorkerPollInterval)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-timer.C:
			timeoutCtx, cancel := context.WithTimeout(context.Background(), w.Cfg.SecretsManagement.GCWorkerPerSecureValueCleanupTimeout)
			if _, err := w.CleanupInactiveSecureValues(timeoutCtx); err != nil {
				logging.FromContext(timeoutCtx).Error("cleaning up inactive secure values", err)
			}
			cancel()
		}
	}
}

func (w *Worker) CleanupInactiveSecureValues(ctx context.Context) ([]secretv1beta1.SecureValue, error) {
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
		if err := sema.Acquire(ctx, 1); err != nil {
			return nil, fmt.Errorf("acquiring semaphore: %w", err)
		}
		go func(i int, sv *secretv1beta1.SecureValue) {
			defer sema.Release(1)
			defer wg.Done()
			errs[i] = w.cleanup(ctx, sv)
		}(i, &sv)
	}

	wg.Wait()

	return secureValues, errors.Join(errs...)
}

func (w *Worker) cleanup(ctx context.Context, sv *secretv1beta1.SecureValue) error {
	keeperCfg, err := w.keeperMetadataStorage.GetKeeperConfig(ctx, sv.Namespace, sv.Spec.Keeper, contracts.ReadOpts{ForUpdate: false})
	if err != nil {
		return fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Spec.Keeper, err)
	}

	keeper, err := w.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", sv.Namespace, sv.Spec.Keeper, err)
	}

	// Keeper deletion is idempotent
	if err := keeper.Delete(ctx, keeperCfg, sv.Namespace, sv.Name, sv.Status.Version); err != nil {
		return fmt.Errorf("deleting secure value from keeper: %w", err)
	}

	// Metadata deletion is not idempotent but not found errors are ignored
	if err := w.secureValueMetadataStorage.Delete(ctx, xkube.Namespace(sv.Namespace), sv.Name, sv.Status.Version); err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
		return fmt.Errorf("deleting secure value from metadata storage: %w", err)
	}

	return nil
}
