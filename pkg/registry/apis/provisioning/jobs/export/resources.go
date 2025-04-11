package export

import (
	"context"
	"errors"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

func ExportResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "start resource export")
	for _, kind := range resources.SupportedProvisioningResources {
		// skip from folders as we do them first... so only dashboards
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", kind.Resource))
		client, _, err := clients.ForResource(kind)
		if err != nil {
			return fmt.Errorf("get client for %s: %w", kind.Resource, err)
		}

		if err := exportResource(ctx, options, client, repositoryResources, progress); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

func exportResource(ctx context.Context, options provisioning.ExportJobOptions, client dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		fileName, err := repositoryResources.CreateResourceFileFromObject(ctx, item, resources.WriteOptions{
			Path: options.Path,
			Ref:  options.Branch,
		})

		gvk := item.GroupVersionKind()
		result := jobs.JobResourceResult{
			Name:     item.GetName(),
			Resource: gvk.Kind,
			Group:    gvk.Group,
			Action:   repository.FileActionCreated,
			Path:     fileName,
		}

		if errors.Is(err, resources.ErrAlreadyInRepository) {
			result.Action = repository.FileActionIgnored
		} else if err != nil {
			result.Action = repository.FileActionIgnored
			result.Error = err
		}

		progress.Record(ctx, result)
		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		return nil
	})
}
