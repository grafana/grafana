package releaseresources

import (
	"context"
	"fmt"
	"time"

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
}

func NewWorker(lister resources.ResourceLister, clientFactory resources.ClientFactory) *Worker {
	return &Worker{
		lister:        lister,
		clientFactory: clientFactory,
	}
}

func (w *Worker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionReleaseResources
}

func (w *Worker) Process(ctx context.Context, _ repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx).With("logger", "release-resources-worker")
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.releaseresources.process")
	defer span.End()
	span.SetAttributes(
		attribute.String("cleanup.action", string(job.Spec.Action)),
		attribute.String("cleanup.repository", job.Spec.Repository),
	)

	namespace := job.GetNamespace()
	repoName := job.Spec.Repository

	items, err := w.lister.List(ctx, namespace, repoName)
	if err != nil {
		return fmt.Errorf("list managed resources: %w", err)
	}

	progress.SetTotal(ctx, len(items.Items))

	if len(items.Items) == 0 {
		progress.SetMessage(ctx, "no managed resources found")
		return nil
	}

	clients, err := w.clientFactory.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("create resource clients: %w", err)
	}

	for _, item := range items.Items {
		result := jobs.NewPathOnlyResult(item.Name)
		result.WithAction(repository.FileActionUpdated)

		res, _, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    item.Group,
			Resource: item.Resource,
		})
		if err != nil {
			result.WithError(fmt.Errorf("get client for %s/%s: %w", item.Group, item.Resource, err))
			progress.Record(ctx, result.Build())
			if tooMany := progress.TooManyErrors(); tooMany != nil {
				return tooMany
			}
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("releasing %s/%s", item.Resource, item.Name))

		patchBytes, err := resources.GetReleasePatch(&item)
		if err != nil {
			result.WithError(fmt.Errorf("build release patch for %s/%s: %w", item.Resource, item.Name, err))
			progress.Record(ctx, result.Build())
			if tooMany := progress.TooManyErrors(); tooMany != nil {
				return tooMany
			}
			continue
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
	}

	return nil
}
