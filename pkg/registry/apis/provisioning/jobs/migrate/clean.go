package migrate

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name NamespaceCleaner --structname MockNamespaceCleaner --inpackage --filename mock_namespace_cleaner.go --with-expecter
type NamespaceCleaner interface {
	// Clean deletes every unmanaged resource of every supported kind in the namespace.
	Clean(ctx context.Context, namespace string, progress jobs.JobProgressRecorder) error
	// CleanResources deletes the named resources, skipping any that are managed by
	// a provisioning system. It is used by a selective branch migration to remove
	// only the resources that were migrated.
	CleanResources(ctx context.Context, namespace string, refs []provisioning.ResourceRef, progress jobs.JobProgressRecorder) error
}

type namespaceCleaner struct {
	clients resources.ClientFactory
}

func NewNamespaceCleaner(clients resources.ClientFactory) NamespaceCleaner {
	return &namespaceCleaner{clients: clients}
}

func (c *namespaceCleaner) Clean(ctx context.Context, namespace string, progress jobs.JobProgressRecorder) error {
	clients, err := c.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get clients: %w", err)
	}

	for _, supported := range clients.SupportedResources() {
		client, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: supported.Group, Kind: supported.Kind})
		if err != nil {
			return fmt.Errorf("get resource client: %w", err)
		}
		progress.SetMessage(ctx, fmt.Sprintf("remove unprovisioned %s", gvr.Resource))

		if err = resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			gvk := item.GroupVersionKind()
			resultBuilder := jobs.NewGVKResult(item.GetName(), gvk).WithAction(repository.FileActionDeleted)

			// Skip provisioned resources - only delete unprovisioned (unmanaged) resources
			meta, err := utils.MetaAccessor(item)
			if err != nil {
				resultBuilder.WithError(fmt.Errorf("extracting meta accessor for resource %s: %w", item.GetName(), err))
				progress.Record(ctx, resultBuilder.Build())
				return nil // Continue with next resource
			}

			_, managed := meta.GetManagerProperties()
			// Skip if resource is managed by any provisioning system. Use the managed
			// flag rather than a non-empty identity: classic shim kinds are reported as
			// managed without an identity and would otherwise be deleted as orphans.
			if managed {
				resultBuilder.WithAction(repository.FileActionIgnored)
				progress.Record(ctx, resultBuilder.Build())
				return nil // Skip this resource
			}

			// Deletion works by name, so we can use any client regardless of version
			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
				resultBuilder.WithError(fmt.Errorf("deleting resource %s/%s %s: %w", item.GroupVersionKind().Group, item.GetKind(), item.GetName(), err))
				progress.Record(ctx, resultBuilder.Build())
				return fmt.Errorf("delete resource: %w", err)
			}

			progress.Record(ctx, resultBuilder.Build())
			return nil
		}); err != nil {
			return err
		}
	}

	return nil
}

func (c *namespaceCleaner) CleanResources(ctx context.Context, namespace string, refs []provisioning.ResourceRef, progress jobs.JobProgressRecorder) error {
	if len(refs) == 0 {
		return nil
	}

	clients, err := c.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get clients: %w", err)
	}

	for _, ref := range refs {
		client, _, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: ref.Group, Kind: ref.Kind})
		if err != nil {
			return fmt.Errorf("get resource client for %s/%s: %w", ref.Group, ref.Kind, err)
		}

		item, err := client.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			// Already gone (e.g. deleted concurrently) is not an error.
			if apierrors.IsNotFound(err) {
				continue
			}
			return fmt.Errorf("get resource %s/%s %s: %w", ref.Group, ref.Kind, ref.Name, err)
		}

		resultBuilder := jobs.NewGVKResult(ref.Name, item.GroupVersionKind()).WithAction(repository.FileActionDeleted)

		// Only delete unmanaged resources - one taken over by any provisioning
		// system must not be removed.
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			resultBuilder.WithError(fmt.Errorf("extracting meta accessor for resource %s: %w", ref.Name, err))
			progress.Record(ctx, resultBuilder.Build())
			continue
		}
		if _, managed := meta.GetManagerProperties(); managed {
			resultBuilder.WithAction(repository.FileActionIgnored)
			progress.Record(ctx, resultBuilder.Build())
			continue
		}

		// Deletion works by name, so we can use any client regardless of version
		if err := client.Delete(ctx, ref.Name, metav1.DeleteOptions{}); err != nil {
			resultBuilder.WithError(fmt.Errorf("deleting resource %s/%s %s: %w", ref.Group, ref.Kind, ref.Name, err))
			progress.Record(ctx, resultBuilder.Build())
			return fmt.Errorf("delete resource: %w", err)
		}

		progress.Record(ctx, resultBuilder.Build())
	}

	return nil
}
