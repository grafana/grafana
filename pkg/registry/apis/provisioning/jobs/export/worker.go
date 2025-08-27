package export

import (
	"context"
	"errors"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name ExportFn --structname MockExportFn --inpackage --filename mock_export_fn.go --with-expecter
type ExportFn func(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name WrapWithStageFn --structname MockWrapWithStageFn --inpackage --filename mock_wrap_with_stage_fn.go --with-expecter
type WrapWithStageFn func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repo repository.Repository, staged bool) error) error

type ExportWorker struct {
	clientFactory       resources.ClientFactory
	repositoryResources resources.RepositoryResourcesFactory
	exportFn            ExportFn
	wrapWithStageFn     WrapWithStageFn
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	exportFn ExportFn,
	wrapWithStageFn WrapWithStageFn,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
		exportFn:            exportFn,
		wrapWithStageFn:     wrapWithStageFn,
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

	msg := options.Message
	if msg == "" {
		msg = fmt.Sprintf("Export from Grafana %s", job.Name)
	}

	cloneOptions := repository.StageOptions{
		Ref:                   options.Branch,
		Timeout:               10 * time.Minute,
		PushOnWrites:          false,
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: msg,
	}

	fn := func(repo repository.Repository, _ bool) error {
		clients, err := r.clientFactory.Clients(ctx, cfg.Namespace)
		if err != nil {
			return fmt.Errorf("create clients: %w", err)
		}

		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("export job submitted targeting repository that is not a ReaderWriter")
		}

		repositoryResources, err := r.repositoryResources.Client(ctx, rw)
		if err != nil {
			return fmt.Errorf("create repository resource client: %w", err)
		}

		return r.exportFn(ctx, cfg.Name, *options, clients, repositoryResources, progress)
	}

	err := r.wrapWithStageFn(ctx, repo, cloneOptions, fn)

	// Set RefURLs if the repository supports it and we have a target branch
	if options.Branch != "" {
		if repoWithURLs, ok := repo.(repository.RepositoryWithURLs); ok {
			if refURLs, urlErr := repoWithURLs.RefURLs(ctx, options.Branch); urlErr == nil && refURLs != nil {
				progress.SetRefURLs(ctx, refURLs)
			}
		}
	}

	return err
}
