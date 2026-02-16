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

// resourceGroup holds pre-loaded items for a single resource kind.
type resourceGroup struct {
	kind  schema.GroupVersionResource
	items []unstructured.Unstructured
	shim  conversionShim
}

// ExportableResources holds pre-loaded, pre-filtered unmanaged resources
type ExportableResources struct {
	groups []resourceGroup
}

// Count returns the total number of pre-loaded exportable resources across all kinds.
func (r ExportableResources) Count() int64 {
	var count int64
	for _, g := range r.groups {
		count += int64(len(g.items))
	}
	return count
}

// LoadExportableResources lists all non-folder resources from the API server.
func LoadExportableResources(ctx context.Context, clients resources.ResourceClients, progress jobs.JobProgressRecorder) (ExportableResources, error) {
	progress.SetMessage(ctx, "loading exportable resources")

	var result ExportableResources
	for _, kind := range resources.SupportedProvisioningResources {
		if kind == resources.FolderResource {
			continue
		}

		client, _, err := clients.ForResource(ctx, kind)
		if err != nil {
			return ExportableResources{}, fmt.Errorf("get client for %s: %w", kind.Resource, err)
		}

		var items []unstructured.Unstructured
		if err := resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			name := item.GetName()
			gvk := item.GroupVersionKind()
			resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(repository.FileActionIgnored)

			meta, err := utils.MetaAccessor(item)
			if err != nil {
				metaError := fmt.Errorf("extracting meta accessor for resource %s: %w", name, err)
				resultBuilder.WithError(metaError)
				progress.Record(ctx, resultBuilder.Build())
				return nil
			}

			manager, _ := meta.GetManagerProperties()
			if manager.Identity != "" {
				progress.Record(ctx, resultBuilder.Build())
				return nil
			}

			items = append(items, *item)
			return nil
		}); err != nil {
			return ExportableResources{}, fmt.Errorf("load %s: %w", kind.Resource, err)
		}

		if len(items) > 0 {
			group := resourceGroup{kind: kind, items: items}
			if kind.GroupResource() == resources.DashboardResource.GroupResource() {
				group.shim = newDashboardConversionShim(kind, clients)
			}
			result.groups = append(result.groups, group)
		}
	}
	return result, nil
}

// newDashboardConversionShim returns a conversionShim that preserves the original apiVersion of dashboards.
func newDashboardConversionShim(kind schema.GroupVersionResource, clients resources.ResourceClients) conversionShim {
	versionClients := make(map[string]dynamic.ResourceInterface)
	return func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
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

// ExportResourcesFromLoaded writes pre-loaded resources to the repository.
func ExportResourcesFromLoaded(ctx context.Context, options provisioning.ExportJobOptions, loaded ExportableResources, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "start resource export")
	for _, group := range loaded.groups {
		progress.SetMessage(ctx, fmt.Sprintf("export %s", group.kind.Resource))

		for i := range group.items {
			if err := exportItem(ctx, &group.items[i], options, group.shim, repositoryResources, progress); err != nil {
				return fmt.Errorf("export %s: %w", group.kind.Resource, err)
			}
		}
	}

	return nil
}

// exportItem processes a single pre-loaded resource
func exportItem(ctx context.Context,
	item *unstructured.Unstructured,
	options provisioning.ExportJobOptions,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	gvk := item.GroupVersionKind()
	name := item.GetName()
	resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(repository.FileActionCreated)

	var err error
	if shim != nil {
		item, err = shim(ctx, item)
	}

	if err == nil {
		var path string
		path, err = repositoryResources.WriteResourceFileFromObject(ctx, item, resources.WriteOptions{
			Path: options.Path,
			Ref:  options.Branch,
		})
		resultBuilder.WithPath(path)
	}

	if errors.Is(err, resources.ErrAlreadyInRepository) {
		resultBuilder.WithAction(repository.FileActionIgnored)
	} else if err != nil {
		resultBuilder.WithAction(repository.FileActionIgnored).
			WithError(fmt.Errorf("writing resource file for %s: %w", name, err))
	}

	progress.Record(ctx, resultBuilder.Build())
	if err := progress.TooManyErrors(); err != nil {
		return err
	}

	return nil
}
