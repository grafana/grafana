package migrate

import (
	"context"
	"errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

//go:generate mockery --name Migrator --structname MockMigrator --inpackage --filename mock_migrator.go --with-expecter
type Migrator interface {
	Migrate(ctx context.Context, rw repository.ReaderWriter, opts provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error
}

type MigrationWorker struct {
	storageStatus   dualwrite.Service
	legacyMigrator  Migrator
	unifiedMigrator Migrator
}

func NewMigrationWorkerFromUnified(unifiedMigrator Migrator) *MigrationWorker {
	return &MigrationWorker{
		unifiedMigrator: unifiedMigrator,
	}
}

// HACK: we should decouple the implementation of these two
func NewMigrationWorker(
	legacyMigrator Migrator,
	unifiedMigrator Migrator,
	storageStatus dualwrite.Service,
) *MigrationWorker {
	return &MigrationWorker{
		unifiedMigrator: unifiedMigrator,
		legacyMigrator:  legacyMigrator,
		storageStatus:   storageStatus,
	}
}

func (w *MigrationWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMigrate
}

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

	if options.History {
		if repo.Config().Spec.Type != provisioning.GitHubRepositoryType {
			return errors.New("history is only supported for github repositories")
		}
	}

	// Block migrate for legacy resources if repository type is folder
	if repo.Config().Spec.Sync.Target == provisioning.SyncTargetTypeFolder {
		// HACK: we should not have to check for storage existance here
		if w.storageStatus != nil && dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, w.storageStatus) {
			return errors.New("migration of legacy resources is not supported for folder-type repositories")
		}
	}

	// HACK: we should not have to check for storage existance here
	if w.storageStatus != nil && dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, w.storageStatus) {
		return w.legacyMigrator.Migrate(ctx, rw, *options, progress)
	}

	if options.History {
		return errors.New("history is not yet supported in unified storage")
	}

	return w.unifiedMigrator.Migrate(ctx, rw, *options, progress)
}
