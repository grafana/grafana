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
	"k8s.io/client-go/dynamic"
)

//go:generate mockery --name ExportFn --structname MockExportFn --inpackage --filename mock_export_fn.go --with-expecter
type ExportFn func(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, folderClient dynamic.ResourceInterface, progress jobs.JobProgressRecorder) error

//go:generate mockery --name WrapWithCloneFn --structname MockWrapWithCloneFn --inpackage --filename mock_wrap_with_clone_fn.go --with-expecter
type WrapWithCloneFn func(ctx context.Context, repo repository.Repository, cloneOptions repository.CloneOptions, pushOptions repository.PushOptions, fn func(repo repository.Repository, cloned bool) error) error

type ExportWorker struct {
	clientFactory       resources.ClientFactory
	repositoryResources resources.RepositoryResourcesFactory
	exportFn            ExportFn
	wrapWithCloneFn     WrapWithCloneFn
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	exportFn ExportFn,
	wrapWithCloneFn WrapWithCloneFn,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
		exportFn:            exportFn,
		wrapWithCloneFn:     wrapWithCloneFn,
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
			// :( the branch is now baked into the repo
			if options.Branch != "" {
				return fmt.Errorf("branch is not supported for clonable repositories")
			}

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

	fn := func(repo repository.Repository, _ bool) error {
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

		return r.exportFn(ctx, cfg.Name, *options, clients, repositoryResources, folderClient, progress)
	}

	return r.wrapWithCloneFn(ctx, repo, cloneOptions, pushOptions, fn)
}
