package export

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/open-feature/go-sdk/openfeature"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	metrics             jobs.JobMetrics
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	exportFn ExportFn,
	wrapWithStageFn WrapWithStageFn,
	metrics jobs.JobMetrics,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
		exportFn:            exportFn,
		wrapWithStageFn:     wrapWithStageFn,
		metrics:             metrics,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPush
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	options := job.Spec.Push
	if options == nil {
		return errors.New("missing export settings")
	}

	cfg := repo.Config()
	evalCtx := features.EvaluationContextFromTargetingKey(cfg.Namespace)
	enabled := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningExport, false, evalCtx)
	if !enabled {
		// A disabled feature is an expected configuration state, not a failure:
		// complete the job in a warning state so it is not logged or alerted as an error.
		return jobs.AsWarning(errors.New("push jobs require the provisioningExport feature flag"))
	}

	logger := logging.FromContext(ctx).With("options", options)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.export.process")
	defer func() {
		if processErr != nil {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.String("export.branch", options.Branch),
		attribute.String("export.folder", options.Folder),
		attribute.String("export.path", options.Path),
		attribute.Int("export.resources_count", len(options.Resources)),
	)

	// Can write to external branch
	if err := repository.IsWriteAllowed(cfg, options.Branch); err != nil {
		return err
	}

	clients, err := r.clientFactory.Clients(ctx, cfg.Namespace)
	if err != nil {
		return fmt.Errorf("create clients: %w", err)
	}

	defaultMsg := options.Message
	if defaultMsg == "" {
		defaultMsg = fmt.Sprintf("Export from Grafana %s", job.Name)
	}
	msg := jobs.CommitMessage(job, defaultMsg)

	cloneOptions := repository.StageOptions{
		Ref:                   options.Branch,
		Timeout:               10 * time.Minute,
		PushOnWrites:          false,
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: msg,
	}

	fn := func(repo repository.Repository, _ bool) error {
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

		return r.exportFn(ctx, cfg.Name, *options, clients, repositoryResources, progress)
	}

	err = r.wrapWithStageFn(ctx, repo, cloneOptions, fn)

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

	// Finalize the progress recorder. The job metric is recorded by the driver from
	// the job's final status, so the returned status is not needed here.
	progress.Complete(ctx, nil)

	return nil
}
