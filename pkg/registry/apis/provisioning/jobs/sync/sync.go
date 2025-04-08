package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name Syncer --structname MockSyncer --inpackage --filename syncer_mock.go --with-expecter
type Syncer interface {
	Sync(ctx context.Context, repo repository.ReaderWriter, options provisioning.SyncJobOptions, repositoryResources resources.RepositoryResources, clients resources.ResourceClients, progress jobs.JobProgressRecorder) (string, error)
}

type syncer struct {
	compare         CompareFn
	fullSync        FullSyncFn
	incrementalSync IncrementalSyncFn
}

func NewSyncer(clients resources.ClientFactory, compare CompareFn, fullSync FullSyncFn, incrementalSync IncrementalSyncFn) Syncer {
	return &syncer{
		compare:         compare,
		fullSync:        fullSync,
		incrementalSync: incrementalSync,
	}
}

func (r *syncer) Sync(ctx context.Context, repo repository.ReaderWriter, options provisioning.SyncJobOptions, repositoryResources resources.RepositoryResources, clients resources.ResourceClients, progress jobs.JobProgressRecorder) (string, error) {
	cfg := repo.Config()
	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := repositoryResources.EnsureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			return "", fmt.Errorf("create root folder: %w", err)
		}
	}

	var currentRef string
	versionedRepo, _ := repo.(repository.Versioned)
	if versionedRepo != nil {
		var err error
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return "", fmt.Errorf("get latest ref: %w", err)
		}

		if cfg.Status.Sync.LastRef != "" && options.Incremental {
			if currentRef == cfg.Status.Sync.LastRef {
				progress.SetFinalMessage(ctx, "same commit as last sync")
				return currentRef, nil
			}

			progress.SetMessage(ctx, "incremental sync")

			return currentRef, r.incrementalSync(ctx, versionedRepo, cfg.Status.Sync.LastRef, currentRef, repositoryResources, progress)
		}
	}

	progress.SetMessage(ctx, "full sync")

	return currentRef, r.fullSync(ctx, repo, r.compare, clients, currentRef, repositoryResources, progress)
}
