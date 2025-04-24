package export

import (
	"context"
	"errors"
	"fmt"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type versionUpgrader = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error)

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

		// When requesting v2 (or v0) dashboards over the v1 api, we want to keep the original apiVersion if conversion fails
		var upgrader versionUpgrader
		if kind.GroupResource() == resources.DashboardResource.GroupResource() {
			var v2client dynamic.ResourceInterface
			upgrader = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				failed, _, _ := unstructured.NestedBool(item.Object, "status", "conversion", "failed")
				if failed {
					storedVersion, _, _ := unstructured.NestedString(item.Object, "status", "conversion", "storedVersion")

					// For v2 we need to request the original version
					if strings.HasPrefix(storedVersion, "v2") {
						if v2client == nil {
							v2client, _, err = clients.ForResource(resources.DashboardResourceV2)
							if err != nil {
								return nil, err
							}
						}
						return v2client.Get(ctx, item.GetName(), v1.GetOptions{})
					}

					// For v0 we can simply fallback -- the full model is saved, but
					if strings.HasPrefix(storedVersion, "v0") {
						item.SetAPIVersion(fmt.Sprintf("%s/%s", kind.Group, storedVersion))
						return item, nil
					}

					return nil, fmt.Errorf("unsupported dashboard version: %s", storedVersion)
				}
				return item, nil
			}
		}

		if err := exportResource(ctx, options, client, upgrader, repositoryResources, progress); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

func exportResource(ctx context.Context,
	options provisioning.ExportJobOptions,
	client dynamic.ResourceInterface,
	upgrader versionUpgrader,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) (err error) {
		gvk := item.GroupVersionKind()
		result := jobs.JobResourceResult{
			Name:     item.GetName(),
			Resource: gvk.Kind,
			Group:    gvk.Group,
			Action:   repository.FileActionCreated,
		}

		if upgrader != nil {
			item, err = upgrader(ctx, item)
		}
		if err != nil {
			result.Path, err = repositoryResources.WriteResourceFileFromObject(ctx, item, resources.WriteOptions{
				Path: options.Path,
				Ref:  options.Branch,
			})
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
