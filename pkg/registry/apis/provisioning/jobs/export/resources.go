package export

import (
	"context"
	"errors"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FIXME: This is used to make sure we save dashboards in the apiVersion they were original saved in
// When requesting v0 or v2 dashboards over the v1 api -- the backend tries (and fails!) to convert values
// The response status indicates the original stored version, so we can then request it in an un-converted form
type conversionShim = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error)

func ExportResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "start resource export")
	for _, kind := range resources.SupportedProvisioningResources {
		// skip from folders as we do them first... so only dashboards
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", kind.Resource))
		client, _, err := clients.ForResource(ctx, kind)
		if err != nil {
			return fmt.Errorf("get client for %s: %w", kind.Resource, err)
		}

		// When requesting dashboards over the v1 api, we want to keep the original apiVersion if conversion fails
		var shim conversionShim
		if kind.GroupResource() == resources.DashboardResource.GroupResource() {
			// Cache clients for different versions
			versionClients := make(map[string]dynamic.ResourceInterface)
			shim = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
				// Check if there's a stored version in the conversion status.
				// This indicates the original API version the dashboard was created with,
				// which should be preserved during export regardless of whether conversion succeeded or failed.
				storedVersion, _, _ := unstructured.NestedString(item.Object, "status", "conversion", "storedVersion")
				if storedVersion != "" {
					// For v0 we can simply fallback -- the full model is saved
					if strings.HasPrefix(storedVersion, "v0") {
						item.SetAPIVersion(fmt.Sprintf("%s/%s", kind.Group, storedVersion))
						return item, nil
					}

					// For any other version (v1, v2, v3, etc.), fetch the original version via client
					// Check if we already have a client cached for this version
					versionClient, ok := versionClients[storedVersion]
					if !ok {
						// Dynamically construct the GroupVersionResource for any version
						versionGVR := schema.GroupVersionResource{
							Group:    kind.Group,
							Version:  storedVersion,
							Resource: kind.Resource,
						}
						var err error
						versionClient, _, err = clients.ForResource(ctx, versionGVR)
						if err != nil {
							return nil, fmt.Errorf("get client for version %s: %w", storedVersion, err)
						}
						versionClients[storedVersion] = versionClient
					}
					return versionClient.Get(ctx, item.GetName(), metav1.GetOptions{})
				}

				// If conversion failed but there's no storedVersion, this is an error condition
				failed, _, _ := unstructured.NestedBool(item.Object, "status", "conversion", "failed")
				if failed {
					return nil, fmt.Errorf("conversion failed but no storedVersion available")
				}

				return item, nil
			}
		}

		if err := exportResource(ctx, kind.Resource, options, client, shim, repositoryResources, progress); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

func exportResource(ctx context.Context,
	resource string,
	options provisioning.ExportJobOptions,
	client dynamic.ResourceInterface,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	// FIXME: using k8s list will force evrything into one version -- we really want the original saved version
	// this will work well enough for now, but needs to be revisted as we have a bigger mix of active versions
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) (err error) {
		gvk := item.GroupVersionKind()
		result := jobs.JobResourceResult{
			Name:   item.GetName(),
			Group:  gvk.Group,
			Kind:   gvk.Kind,
			Action: repository.FileActionCreated,
		}

		// Check if resource is already managed by a repository
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("extracting meta accessor for resource %s: %w", result.Name, err)
			progress.Record(ctx, result)
			return nil
		}

		manager, _ := meta.GetManagerProperties()
		// Skip if already managed by any manager (repository, file provisioning, etc.)
		if manager.Identity != "" {
			result.Action = repository.FileActionIgnored
			progress.Record(ctx, result)
			return nil
		}

		if shim != nil {
			item, err = shim(ctx, item)
		}

		if err == nil {
			result.Path, err = repositoryResources.WriteResourceFileFromObject(ctx, item, resources.WriteOptions{
				Path: options.Path,
				Ref:  options.Branch,
			})
		}

		if errors.Is(err, resources.ErrAlreadyInRepository) {
			result.Action = repository.FileActionIgnored
		} else if err != nil {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("writing resource file for %s: %w", result.Name, err)
		}

		progress.Record(ctx, result)
		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		return nil
	})
}
