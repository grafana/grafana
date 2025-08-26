package garbagecollectionworker

import (
	"context"
	"errors"
	"fmt"
	"sync"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"golang.org/x/sync/semaphore"
)

type Config struct {
	// Max number of inactive secure values to fetch from the database.
	MaxBatchSize uint16
	// Max number of tasks to delete secure values that can be inflight at a time.
	MaxConcurrentCleanups uint16
}

// Secure values have the `active` flag set to false on creation and deletion.
// The `active` flag is set to true when the creation process succeeds.
// The worker deletes secure values that are inactive because the creation process failed
// or because the secure value has been deleted.
type Worker struct {
	Cfg                        Config
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
}

func NewWorker(
	cfg Config,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService) (*Worker, error) {
	if cfg.MaxBatchSize == 0 {
		return nil, fmt.Errorf("MaxBatchSize is required")
	}
	if cfg.MaxConcurrentCleanups == 0 {
		return nil, fmt.Errorf("MaxConcurrentCleanups is required")
	}
	return &Worker{
		Cfg:                        cfg,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService}, nil
}

func (w *Worker) CleanupInactiveSecureValues(ctx context.Context) ([]secretv1beta1.SecureValue, error) {
	secureValues, err := w.secureValueMetadataStorage.LeaseInactiveSecureValues(ctx, w.Cfg.MaxBatchSize)
	if err != nil {
		return nil, fmt.Errorf("fetching inactive secure values that need to be cleaned up: %w", err)
	}
	if len(secureValues) == 0 {
		return nil, nil
	}

	errs := make([]error, len(secureValues))

	sema := semaphore.NewWeighted(int64(w.Cfg.MaxConcurrentCleanups))
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

	if err := keeper.Delete(ctx, keeperCfg, sv.Namespace, sv.Name, sv.Status.Version); err != nil {
		// TODO: ignore not found, deleting should be idempotent
		return fmt.Errorf("deleting secure value from keeper: %w", err)
	}

	if err := w.secureValueMetadataStorage.Delete(ctx, xkube.Namespace(sv.Namespace), sv.Name, sv.Status.Version); err != nil {
		return fmt.Errorf("deleting secure value from metadata storage: %w", err)
	}

	return nil
}
