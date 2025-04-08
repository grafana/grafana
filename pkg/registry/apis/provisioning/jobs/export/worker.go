package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ExportWorker struct {
	clientFactory       resources.ClientFactory
	repositoryResources resources.RepositoryResourcesFactory
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPush
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Push
	if options == nil {
		return errors.New("missing export settings")
	}

	cfg := repo.Config()
	// Can write to external branch
	if err := repository.IsWriteAllowed(cfg, options.Branch); err != nil {
		return err
	}

	cloneOptions := repository.CloneOptions{
		Timeout:      10 * time.Minute,
		PushOnWrites: false,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "clone target")
			return nil
		},
	}

	pushOptions := repository.PushOptions{
		Timeout:  10 * time.Minute,
		Progress: os.Stdout,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "push changes")
			return nil
		},
	}

	fn := func(repo repository.Repository, cloned bool) error {
		if cloned {
			options.Branch = "" // :( the branch is now baked into the repo
		}

		// Load and write all folders
		// FIXME: we load the entire tree in memory
		progress.SetMessage(ctx, "read folder tree from API server")
		clients, err := r.clientFactory.Clients(ctx, cfg.Namespace)
		if err != nil {
			return fmt.Errorf("create clients: %w", err)
		}

		folderClient, err := clients.Folder()
		if err != nil {
			return fmt.Errorf("create folder client: %w", err)
		}

		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("export job submitted targeting repository that is not a ReaderWriter")
		}

		repositoryResources, err := r.repositoryResources.Client(ctx, rw)
		if err != nil {
			return fmt.Errorf("create repository resource client: %w", err)
		}

		if err := ExportFolders(ctx, cfg.Name, *options, folderClient, repositoryResources, progress); err != nil {
			return err
		}

		if err := ExportResources(ctx, *options, clients, repositoryResources, progress); err != nil {
			return err
		}

		return nil
	}

	return repository.WrapWithCloneAndPushIfPossible(ctx, repo, cloneOptions, pushOptions, fn)
}
