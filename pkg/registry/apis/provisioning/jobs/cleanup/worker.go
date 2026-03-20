package cleanup

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Worker handles releaseResources and deleteResources job actions.
// These actions operate on orphaned resources whose managing repository
// no longer exists or is stuck in Terminating state.
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
	return job.Spec.Action == provisioning.JobActionReleaseResources ||
		job.Spec.Action == provisioning.JobActionDeleteResources
}

func (w *Worker) Process(ctx context.Context, _ repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx).With("logger", "cleanup-worker", "action", job.Spec.Action)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.cleanup.process")
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

	resources.SortResourceListForDeletion(items)
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

		switch job.Spec.Action {
		case provisioning.JobActionReleaseResources:
			result.WithAction(repository.FileActionUpdated)
			progress.SetMessage(ctx, fmt.Sprintf("releasing %s/%s", item.Resource, item.Name))
			err = w.releaseResource(ctx, res, &item)
		case provisioning.JobActionDeleteResources:
			result.WithAction(repository.FileActionDeleted)
			progress.SetMessage(ctx, fmt.Sprintf("deleting %s/%s", item.Resource, item.Name))
			err = w.deleteResource(ctx, res, &item)
		}

		if err != nil {
			if apierrors.IsNotFound(err) {
				logger.Info("resource not found, skipping", "name", item.Name, "group", item.Group, "resource", item.Resource)
			} else {
				result.WithError(fmt.Errorf("process %s/%s: %w", item.Resource, item.Name, err))
			}
		}

		progress.Record(ctx, result.Build())
		if tooMany := progress.TooManyErrors(); tooMany != nil {
			return tooMany
		}
	}

	return nil
}

func (w *Worker) releaseResource(ctx context.Context, client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
	patchBytes, err := resources.GetReleasePatch(item)
	if err != nil {
		return fmt.Errorf("build release patch: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	_, err = client.Patch(ctx, item.Name, types.JSONPatchType, patchBytes, v1.PatchOptions{})
	return err
}

func (w *Worker) deleteResource(ctx context.Context, client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	return client.Delete(ctx, item.Name, v1.DeleteOptions{})
}
