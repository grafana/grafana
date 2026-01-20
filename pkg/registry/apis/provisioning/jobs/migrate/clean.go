package migrate

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name NamespaceCleaner --structname MockNamespaceCleaner --inpackage --filename mock_namespace_cleaner.go --with-expecter
type NamespaceCleaner interface {
	Clean(ctx context.Context, namespace string, progress jobs.JobProgressRecorder) error
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

	for _, kind := range resources.SupportedProvisioningResources {
		progress.SetMessage(ctx, fmt.Sprintf("remove unprovisioned %s", kind.Resource))
		client, _, err := clients.ForResource(ctx, kind)
		if err != nil {
			return fmt.Errorf("get resource client: %w", err)
		}

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

			manager, _ := meta.GetManagerProperties()
			// Skip if resource is managed by any provisioning system
			if manager.Identity != "" {
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
