package releaseresources

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/concurrency"
	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Worker handles the releaseResources job action.
// It removes ownership annotations from all resources managed by a repository
// that no longer exists or is stuck in Terminating state, leaving them as
// unmanaged resources in Grafana.
// The repo parameter in Process may be nil when the repository has been deleted.
type Worker struct {
	lister        resources.ResourceLister
	clientFactory resources.ClientFactory
	maxWorkers    int
}

func NewWorker(lister resources.ResourceLister, clientFactory resources.ClientFactory, maxWorkers int) *Worker {
	return &Worker{
		lister:        lister,
		clientFactory: clientFactory,
		maxWorkers:    maxWorkers,
	}
}

func (w *Worker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionReleaseResources
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx).With("logger", "release-resources-worker")
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.releaseresources.process")
	defer span.End()
	span.SetAttributes(
		attribute.String("cleanup.action", string(job.Spec.Action)),
		attribute.String("cleanup.repository", job.Spec.Repository),
	)

	if err := jobs.ValidateRepoForCleanup(repo); err != nil {
		return err
	}

	namespace := job.GetNamespace()
	repoName := job.Spec.Repository

	// Phase 1: List managed resources
	progress.SetMessage(ctx, "listing managed resources")
	listCtx, listSpan := tracing.Start(ctx, "provisioning.releaseresources.list")
	items, err := w.lister.List(listCtx, namespace, repoName)
	listSpan.End()
	if err != nil {
		return fmt.Errorf("list managed resources: %w", err)
	}

	resources.SortResourceListForRelease(items)
	folderItems, resourceItems := resources.SplitItems(items)
	progress.SetTotal(ctx, len(items.Items))
	span.SetAttributes(
		attribute.Int("release.total", len(items.Items)),
		attribute.Int("release.folders", len(folderItems)),
		attribute.Int("release.resources", len(resourceItems)),
	)

	if len(items.Items) == 0 {
		progress.SetMessage(ctx, "no managed resources found")
		return nil
	}

	clients, err := w.clientFactory.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("create resource clients: %w", err)
	}

	// Phase 2: Release folders sequentially (top-down to respect hierarchy)
	if len(folderItems) > 0 {
		progress.SetMessage(ctx, fmt.Sprintf("releasing %d folders", len(folderItems)))
		folderCtx, folderSpan := tracing.Start(ctx, "provisioning.releaseresources.folders",
			attribute.Int("count", len(folderItems)),
		)
		for _, item := range folderItems {
			if err := w.releaseItem(folderCtx, clients, item, progress); err != nil {
				folderSpan.End()
				return err
			}
		}
		folderSpan.End()
	}

	// Phase 3: Release non-folder resources concurrently
	if len(resourceItems) > 0 {
		progress.SetMessage(ctx, fmt.Sprintf("releasing %d resources", len(resourceItems)))
		resCtx, resSpan := tracing.Start(ctx, "provisioning.releaseresources.resources",
			attribute.Int("count", len(resourceItems)),
		)
		err = concurrency.ForEachJob(resCtx, len(resourceItems), w.maxWorkers, func(jobCtx context.Context, idx int) error {
			return w.releaseItem(jobCtx, clients, resourceItems[idx], progress)
		})
		resSpan.End()
		if err != nil {
			return err
		}
	}

	progress.SetMessage(ctx, fmt.Sprintf("released %d items", len(items.Items)))
	return nil
}

func (w *Worker) releaseItem(ctx context.Context, clients resources.ResourceClients, item *provisioning.ResourceListItem, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx)
	result := jobs.NewResourceResult().
		WithName(item.Name).
		WithPath(item.Path).
		WithAction(repository.FileActionUpdated)

	res, gvk, err := clients.ForResource(ctx, schema.GroupVersionResource{
		Group:    item.Group,
		Resource: item.Resource,
	})
	if err == nil {
		result.WithGVK(gvk)
	}
	if err != nil {
		result.WithError(fmt.Errorf("get client for %s/%s: %w", item.Group, item.Resource, err))
		progress.Record(ctx, result.Build())
		if tooMany := progress.TooManyErrors(); tooMany != nil {
			return tooMany
		}
		return nil
	}

	patchBytes, err := resources.GetReleasePatch(item)
	if err != nil {
		result.WithError(fmt.Errorf("build release patch for %s/%s: %w", item.Resource, item.Name, err))
		progress.Record(ctx, result.Build())
		if tooMany := progress.TooManyErrors(); tooMany != nil {
			return tooMany
		}
		return nil
	}

	patchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	_, err = res.Patch(patchCtx, item.Name, types.JSONPatchType, patchBytes, v1.PatchOptions{})
	cancel()

	if err != nil {
		if apierrors.IsNotFound(err) {
			logger.Info("resource not found, skipping", "name", item.Name, "group", item.Group, "resource", item.Resource)
		} else {
			result.WithError(fmt.Errorf("release %s/%s: %w", item.Resource, item.Name, err))
		}
	}

	progress.Record(ctx, result.Build())
	if tooMany := progress.TooManyErrors(); tooMany != nil {
		return tooMany
	}

	return nil
}
