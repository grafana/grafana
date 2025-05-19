package migrate

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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
		client, _, err := clients.ForResource(kind)
		if err != nil {
			return fmt.Errorf("get resource client: %w", err)
		}

		if err = resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			result := jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: item.GetKind(),
				Group:    item.GroupVersionKind().Group,
				Action:   repository.FileActionDeleted,
			}

			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
				result.Error = err
				progress.Record(ctx, result)
				return fmt.Errorf("delete resource: %w", err)
			}

			progress.Record(ctx, result)
			return nil
		}); err != nil {
			return err
		}
	}

	return nil
}
