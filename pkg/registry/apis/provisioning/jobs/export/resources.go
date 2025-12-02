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
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FIXME: This is used to make sure we save dashboards in the apiVersion they were original saved in
// When requesting v0 or v2 dashboards over the v1 api -- the backend tries (and fails!) to convert values
// The response status indicates the original stored version, so we can then request it in an un-converted form
type conversionShim = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error)

// createDashboardConversionShim creates a conversion shim for dashboards that preserves the original API version.
// It caches version clients to avoid repeated lookups.
func createDashboardConversionShim(ctx context.Context, clients resources.ResourceClients, gvr schema.GroupVersionResource) (conversionShim, map[string]dynamic.ResourceInterface) {
	versionClients := make(map[string]dynamic.ResourceInterface)
	shim := func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
		// Check if there's a stored version in the conversion status.
		// This indicates the original API version the dashboard was created with,
		// which should be preserved during export regardless of whether conversion succeeded or failed.
		storedVersion, _, _ := unstructured.NestedString(item.Object, "status", "conversion", "storedVersion")
		if storedVersion != "" {
			// For v0 we can simply fallback -- the full model is saved
			if strings.HasPrefix(storedVersion, "v0") {
				item.SetAPIVersion(fmt.Sprintf("%s/%s", gvr.Group, storedVersion))
				return item, nil
			}

			// For any other version (v1, v2, v3, etc.), fetch the original version via client
			// Check if we already have a client cached for this version
			versionClient, ok := versionClients[storedVersion]
			if !ok {
				// Dynamically construct the GroupVersionResource for any version
				versionGVR := schema.GroupVersionResource{
					Group:    gvr.Group,
					Version:  storedVersion,
					Resource: gvr.Resource,
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
	return shim, versionClients
}

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
			shim, _ = createDashboardConversionShim(ctx, clients, kind)
		}

		if err := exportResource(ctx, kind.Resource, options, client, shim, repositoryResources, progress); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

// ExportSpecificResources exports a list of specific resources identified by ResourceRef entries.
// It validates that resources are not folders, are supported, and are unmanaged.
func ExportSpecificResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	if len(options.Resources) == 0 {
		return errors.New("no resources specified for export")
	}

	progress.SetMessage(ctx, "exporting specific resources")

	// Load folder tree into memory so we can resolve folder paths for resources
	// This is needed to replicate the folder structure when exporting
	progress.SetMessage(ctx, "loading folder tree from API server")
	folderClient, err := clients.Folder(ctx)
	if err != nil {
		return fmt.Errorf("get folder client: %w", err)
	}

	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}

		manager, _ := meta.GetManagerProperties()
		// Skip if already managed by any manager (repository, file provisioning, etc.)
		if manager.Identity != "" {
			return nil
		}

		return tree.AddUnstructured(item)
	}); err != nil {
		return fmt.Errorf("load folder tree: %w", err)
	}

	// Create a shared dashboard conversion shim and cache for all dashboard resources
	// The versionClients map is captured in the shim closure and shared across all calls
	var dashboardShim conversionShim

	for _, resourceRef := range options.Resources {
		result := jobs.JobResourceResult{
			Name:   resourceRef.Name,
			Group:  resourceRef.Group,
			Kind:   resourceRef.Kind,
			Action: repository.FileActionCreated,
		}

		gvk := schema.GroupVersionKind{
			Group: resourceRef.Group,
			Kind:  resourceRef.Kind,
			// Version is left empty so ForKind will use the preferred version
		}

		// Validate: reject folders
		if gvk.Kind == resources.FolderKind.Kind || gvk.Group == resources.FolderResource.Group {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("folders are not supported for export")
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Get client for this resource type
		progress.SetMessage(ctx, fmt.Sprintf("Fetching resource %s/%s/%s", resourceRef.Group, resourceRef.Kind, resourceRef.Name))
		client, gvr, err := clients.ForKind(ctx, gvk)
		if err != nil {
			result.Error = fmt.Errorf("get client for %s/%s/%s: %w", resourceRef.Group, resourceRef.Kind, resourceRef.Name, err)
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Validate: check if resource is supported
		isSupported := false
		for _, supported := range resources.SupportedProvisioningResources {
			if supported.Group == gvr.Group && supported.Resource == gvr.Resource {
				isSupported = true
				break
			}
		}
		if !isSupported {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("resource type %s/%s is not supported for export", gvr.Group, gvr.Resource)
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Fetch the resource from the API server
		item, err := client.Get(ctx, resourceRef.Name, metav1.GetOptions{})
		if err != nil {
			result.Error = fmt.Errorf("get resource %s/%s/%s: %w", resourceRef.Group, resourceRef.Kind, resourceRef.Name, err)
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Validate: check if resource is managed
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("extracting meta accessor for resource %s: %w", result.Name, err)
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		manager, _ := meta.GetManagerProperties()
		// Reject if already managed by any manager (repository, file provisioning, etc.)
		if manager.Identity != "" {
			result.Action = repository.FileActionIgnored
			result.Error = fmt.Errorf("resource %s/%s/%s is managed and cannot be exported", resourceRef.Group, resourceRef.Kind, resourceRef.Name)
			progress.Record(ctx, result)
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Handle dashboard version conversion using the shared shim logic
		if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
			// Create or reuse the dashboard shim (shared across all dashboard resources)
			// The versionClients map is captured in the shim closure and shared across all calls
			// This ensures client caching works correctly when exporting multiple dashboards
			if dashboardShim == nil {
				dashboardShim, _ = createDashboardConversionShim(ctx, clients, gvr)
			}

			item, err = dashboardShim(ctx, item)
			if err != nil {
				result.Error = fmt.Errorf("converting dashboard %s/%s/%s: %w", resourceRef.Group, resourceRef.Kind, resourceRef.Name, err)
				progress.Record(ctx, result)
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
			// Re-extract meta after shim conversion in case the item changed
			meta, err = utils.MetaAccessor(item)
			if err != nil {
				result.Action = repository.FileActionIgnored
				result.Error = fmt.Errorf("extracting meta accessor after conversion for resource %s: %w", result.Name, err)
				progress.Record(ctx, result)
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
		}

		// Get the folder path from the unmanaged folder tree and concatenate with Path
		// This gives us the path in the unmanaged tree structure
		exportPath := options.Path
		resourceFolder := meta.GetFolder()
		if resourceFolder != "" {
			// Get the folder path from the unmanaged tree (rootFolder is empty string for unmanaged tree)
			fid, ok := tree.DirPath(resourceFolder, "")
			if ok && fid.Path != "" {
				if exportPath != "" {
					exportPath = safepath.Join(exportPath, fid.Path)
				} else {
					exportPath = fid.Path
				}
			}
		}

		// Temporarily clear folder metadata so WriteResourceFileFromObject doesn't try to resolve
		// folder paths from repository tree (we've already computed the path from unmanaged tree)
		originalFolder := resourceFolder
		if resourceFolder != "" {
			meta.SetFolder("")
		}

		// Export the resource
		progress.SetMessage(ctx, fmt.Sprintf("Exporting resource %s/%s/%s", resourceRef.Group, resourceRef.Kind, resourceRef.Name))
		result.Path, err = repositoryResources.WriteResourceFileFromObject(ctx, item, resources.WriteOptions{
			Path: exportPath, // Path already includes folder structure from unmanaged tree
			Ref:  options.Branch,
		})

		// Restore original folder metadata
		if originalFolder != "" {
			meta.SetFolder(originalFolder)
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
