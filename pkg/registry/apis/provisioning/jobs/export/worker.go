package export

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

//go:generate mockery --name ExportFn --structname MockExportFn --inpackage --filename mock_export_fn.go --with-expecter
type ExportFn func(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name WrapWithStageFn --structname MockWrapWithStageFn --inpackage --filename mock_wrap_with_stage_fn.go --with-expecter
type WrapWithStageFn func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repo repository.Repository, staged bool) error) error

type ExportWorker struct {
	clientFactory             resources.ClientFactory
	repositoryResources       resources.RepositoryResourcesFactory
	exportAllFn               ExportFn
	exportSpecificResourcesFn ExportFn
	wrapWithStageFn           WrapWithStageFn
	metrics                   jobs.JobMetrics
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	exportAllFn ExportFn,
	exportSpecificResourcesFn ExportFn,
	wrapWithStageFn WrapWithStageFn,
	metrics jobs.JobMetrics,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:             clientFactory,
		repositoryResources:       repositoryResources,
		exportAllFn:               exportAllFn,
		exportSpecificResourcesFn: exportSpecificResourcesFn,
		wrapWithStageFn:           wrapWithStageFn,
		metrics:                   metrics,
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

	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	start := time.Now()
	outcome := utils.ErrorOutcome
	resourcesExported := 0
	defer func() {
		r.metrics.RecordJob(string(provisioning.JobActionPush), outcome, resourcesExported, time.Since(start).Seconds())
	}()
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
			logger.Error("failed to create clients", "error", err)
			return fmt.Errorf("create clients: %w", err)
		}

		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			logger.Error("export job submitted targeting repository that is not a ReaderWriter")
			return errors.New("export job submitted targeting repository that is not a ReaderWriter")
		}

		repositoryResources, err := r.repositoryResources.Client(ctx, rw)
		if err != nil {
			logger.Error("failed to create repository resource client", "error", err)
			return fmt.Errorf("create repository resource client: %w", err)
		}

		// Check if Resources list is provided (specific resources export mode)
		if len(options.Resources) > 0 {
			progress.SetTotal(ctx, len(options.Resources))
			progress.StrictMaxErrors(1) // Fail fast on any error during export
			// Validate that specific resource export is only used with folder sync targets
			if cfg.Spec.Sync.Target != provisioning.SyncTargetTypeFolder {
				return fmt.Errorf("specific resource export is only supported for folder sync targets, but repository has target type '%s'", cfg.Spec.Sync.Target)
			}
			return r.exportSpecificResourcesFn(ctx, cfg.Name, *options, clients, repositoryResources, progress)
		}

		// Fall back to existing ExportAll behavior for backward compatibility
		return r.exportAllFn(ctx, cfg.Name, *options, clients, repositoryResources, progress)
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

	if err != nil {
		logger.Error("failed to export", "error", err)
		return err
	}

	outcome = utils.SuccessOutcome
	jobStatus := progress.Complete(ctx, nil)
	for _, summary := range jobStatus.Summary {
		resourcesExported += int(summary.Write)
	}

	return nil
}
