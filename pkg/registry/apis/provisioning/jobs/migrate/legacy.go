package migrate

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type LegacyMigrator struct {
	legacyMigrator  LegacyResourcesMigrator
	storageSwapper  StorageSwapper
	syncWorker      jobs.Worker
	wrapWithStageFn WrapWithStageFn
}

func NewLegacyMigrator(
	legacyMigrator LegacyResourcesMigrator,
	storageSwapper StorageSwapper,
	syncWorker jobs.Worker,
	wrapWithStageFn WrapWithStageFn,
) *LegacyMigrator {
	return &LegacyMigrator{
		legacyMigrator:  legacyMigrator,
		storageSwapper:  storageSwapper,
		syncWorker:      syncWorker,
		wrapWithStageFn: wrapWithStageFn,
	}
}

func (m *LegacyMigrator) Migrate(ctx context.Context, rw repository.ReaderWriter, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	namespace := rw.Config().Namespace
	stageOptions := repository.StageOptions{
		PushOnWrites: options.History,
		// TODO: make this configurable
		Timeout: 10 * time.Minute,
	}

	if err := m.wrapWithStageFn(ctx, rw, stageOptions, func(repo repository.Repository, staged bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
		}

		return m.legacyMigrator.Migrate(ctx, rw, namespace, options, progress)
	}); err != nil {
		return fmt.Errorf("migrate from SQL: %w", err)
	}

	progress.SetMessage(ctx, "resetting unified storage")
	if err := m.storageSwapper.WipeUnifiedAndSetMigratedFlag(ctx, namespace); err != nil {
		return fmt.Errorf("unable to reset unified storage %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()

	// Delegate the import to a sync (from the already checked out go-git repository!)
	progress.SetMessage(ctx, "pulling resources")
	if err := m.syncWorker.Process(ctx, rw, provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}, progress); err != nil { // this will have an error when too many errors exist
		progress.SetMessage(ctx, "error importing resources, reverting")
		if e2 := m.storageSwapper.StopReadingUnifiedStorage(ctx); e2 != nil {
			logger := logging.FromContext(ctx)
			logger.Warn("error trying to revert dual write settings after an error", "err", err)
		}
		return err
	}

	return nil
}
