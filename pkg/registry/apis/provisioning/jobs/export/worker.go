package export

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

//go:generate mockery --name ExportFn --structname MockExportFn --inpackage --filename mock_export_fn.go --with-expecter
type ExportFn func(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name WrapWithStageFn --structname MockWrapWithStageFn --inpackage --filename mock_wrap_with_stage_fn.go --with-expecter
type WrapWithStageFn func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repo repository.Repository, staged bool) error) error

type ExportWorker struct {
	clientFactory       resources.ClientFactory
	repositoryResources resources.RepositoryResourcesFactory
	resourceLister      resources.ResourceLister
	exportFn            ExportFn
	wrapWithStageFn     WrapWithStageFn
	metrics             jobs.JobMetrics
	enabled             bool
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	resourceLister resources.ResourceLister,
	exportFn ExportFn,
	wrapWithStageFn WrapWithStageFn,
	metrics jobs.JobMetrics,
	enabled bool,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
		resourceLister:      resourceLister,
		exportFn:            exportFn,
		wrapWithStageFn:     wrapWithStageFn,
		metrics:             metrics,
		enabled:             enabled,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPush
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	if !r.enabled {
		return fmt.Errorf("export functionality is disabled by configuration")
	}

	options := job.Spec.Push
	if options == nil {
		return errors.New("missing export settings")
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

	clients, err := r.clientFactory.Clients(ctx, cfg.Namespace)
	if err != nil {
		return fmt.Errorf("create clients: %w", err)
	}

	if err := checkExportQuota(ctx, cfg, *options, r.resourceLister, clients); err != nil {
		progress.Complete(ctx, err)
		return err
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

	outcome = utils.SuccessOutcome
	jobStatus := progress.Complete(ctx, nil)
	for _, summary := range jobStatus.Summary {
		resourcesExported += int(summary.Write)
	}

	return nil
}

func checkExportQuota(ctx context.Context, cfg *provisioning.Repository, options provisioning.ExportJobOptions, lister resources.ResourceLister, clients resources.ResourceClients) error {
	quota := cfg.Status.Quota
	if quota.MaxResourcesPerRepository == 0 {
		return nil
	}

	usage := quotas.NewQuotaUsageFromStats(cfg.Status.Stats)

	var netChange int64
	if len(options.Resources) > 0 {
		// A selective export only writes the explicitly listed resources, so the
		// net change is bounded by that list — not every unmanaged resource in
		// the namespace. Counting the whole namespace here would reject exports
		// whose actual selection stays well within quota.
		netChange = int64(len(options.Resources))
	} else {
		// A full export takes over every unmanaged resource in the namespace.
		stats, err := lister.Stats(ctx, cfg.Namespace, "")
		if err != nil {
			return fmt.Errorf("get resource stats for quota check: %w", err)
		}

		netChange, err = countSupportedResources(ctx, stats.Unmanaged, clients)
		if err != nil {
			return err
		}
	}

	if !quotas.WouldStayWithinQuota(quota, usage, netChange) {
		total := usage.TotalResources + netChange
		return quotas.NewQuotaExceededError(
			fmt.Errorf("export would exceed quota: %d/%d resources", total, quota.MaxResourcesPerRepository),
		)
	}
	return nil
}

// countSupportedResources sums counts for resource types that support provisioning.
// The supported set is identified by group+kind; the plural resource used to match the
// stats is resolved via discovery.
func countSupportedResources(ctx context.Context, stats []provisioning.ResourceCount, clients resources.ResourceClients) (int64, error) {
	supported := make(map[schema.GroupResource]bool)
	for _, kind := range clients.SupportedResources() {
		_, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: kind.Group, Kind: kind.Kind})
		if err != nil {
			return 0, fmt.Errorf("resolve client for %s/%s: %w", kind.Group, kind.Kind, err)
		}
		supported[gvr.GroupResource()] = true
	}

	var total int64
	for _, stat := range stats {
		if supported[schema.GroupResource{Group: stat.Group, Resource: stat.Resource}] {
			total += stat.Count
		}
	}
	return total, nil
}
