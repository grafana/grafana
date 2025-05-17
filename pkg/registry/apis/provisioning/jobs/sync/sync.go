package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name FullSyncFn --structname MockFullSyncFn --inpackage --filename full_sync_fn_mock.go --with-expecter
type FullSyncFn func(ctx context.Context, repo repository.Reader, compare CompareFn, clients resources.ResourceClients, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name CompareFn --structname MockCompareFn --inpackage --filename compare_fn_mock.go --with-expecter
type CompareFn func(ctx context.Context, repo repository.Reader, repositoryResources resources.RepositoryResources, ref string) ([]ResourceFileChange, error)

//go:generate mockery --name IncrementalSyncFn --structname MockIncrementalSyncFn --inpackage --filename incremental_sync_fn_mock.go --with-expecter
type IncrementalSyncFn func(ctx context.Context, repo repository.Versioned, previousRef, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name Syncer --structname MockSyncer --inpackage --filename syncer_mock.go --with-expecter
type Syncer interface {
	Sync(ctx context.Context, repo repository.ReaderWriter, options provisioning.SyncJobOptions, repositoryResources resources.RepositoryResources, clients resources.ResourceClients, progress jobs.JobProgressRecorder) (string, error)
}

type syncer struct {
	compare         CompareFn
	fullSync        FullSyncFn
	incrementalSync IncrementalSyncFn
}

func NewSyncer(compare CompareFn, fullSync FullSyncFn, incrementalSync IncrementalSyncFn) Syncer {
	return &syncer{
		compare:         compare,
		fullSync:        fullSync,
		incrementalSync: incrementalSync,
	}
}

func (r *syncer) Sync(ctx context.Context, repo repository.ReaderWriter, options provisioning.SyncJobOptions, repositoryResources resources.RepositoryResources, clients resources.ResourceClients, progress jobs.JobProgressRecorder) (string, error) {
	cfg := repo.Config()

	var currentRef string
	versionedRepo, ok := repo.(repository.Versioned)
	if ok && versionedRepo != nil {
		var err error
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return "", fmt.Errorf("get latest ref: %w", err)
		}

		if cfg.Status.Sync.LastRef != "" && options.Incremental {
			progress.SetMessage(ctx, "incremental sync")
			return currentRef, r.incrementalSync(ctx, versionedRepo, cfg.Status.Sync.LastRef, currentRef, repositoryResources, progress)
		}
	}

	progress.SetMessage(ctx, "full sync")

	return currentRef, r.fullSync(ctx, repo, r.compare, clients, currentRef, repositoryResources, progress)
}
