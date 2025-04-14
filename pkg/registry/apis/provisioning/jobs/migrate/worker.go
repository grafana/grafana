package migrate

import (
	"context"
	"errors"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type Migrator interface {
	Migrate(ctx context.Context, rw repository.ReaderWriter, opts provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error
}

type MigrationWorker struct {
	storageSwapper  *StorageSwapper
	legacyMigrator  Migrator
	unifiedMigrator Migrator
}

func NewMigrationWorker(
	legacyMigrator Migrator,
	unifiedMigrator Migrator,
	storageSwapper *StorageSwapper,
) *MigrationWorker {
	return &MigrationWorker{
		unifiedMigrator: unifiedMigrator,
		legacyMigrator:  legacyMigrator,
		storageSwapper:  storageSwapper,
	}
}

func (w *MigrationWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMigrate
}

// Process will start a job
func (w *MigrationWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Migrate
	if options == nil {
		return errors.New("missing migrate settings")
	}

	progress.SetTotal(ctx, 10) // will show a progress bar
	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
	}

	if w.storageSwapper.IsReadingFromUnifiedStorage(ctx) {
		return w.unifiedMigrator.Migrate(ctx, rw, *options, progress)
	}

	return w.legacyMigrator.Migrate(ctx, rw, *options, progress)
}
