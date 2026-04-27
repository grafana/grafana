package export

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	grafanautil "github.com/grafana/grafana/pkg/util"
)

// FIXME: This is used to make sure we save dashboards in the apiVersion they were original saved in
// When requesting v0 or v2 dashboards over the v1 api -- the backend tries (and fails!) to convert values
// The response status indicates the original stored version, so we can then request it in an un-converted form
type conversionShim = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error)

func ExportResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
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
			shim = newDashboardConversionShim(kind, clients)
		}

		if err := exportResource(ctx, options, client, shim, repositoryResources, progress, generateNewUIDs); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

// ExportSpecificResources exports the explicit list of resources named in
// options.Resources. It shares the per-item write path with ExportResources
// (manager-identity skip, conversion shim, UID regeneration) but resolves
// items via Get rather than listing the namespace.
//
// Two ref kinds are supported:
//   - Dashboard: a single dashboard fetched by UID.
//   - Folder: the folder is treated as a recursive root — every unmanaged
//     dashboard whose grafana.app/folder annotation lands inside the folder's
//     descendant set is exported. The folder hierarchy itself is emitted by
//     ExportFolders before this function runs, so parent paths resolve.
//
// The admission validator restricts Resources to those two kinds; anything
// else surfaces as a per-resource error so a misconfigured caller fails the
// job rather than silently dropping the reference.
func ExportSpecificResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, folderClient dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	progress.SetMessage(ctx, "start selective resource export")

	dashboardRefs, folderRefs, unsupportedRefs := splitExportRefs(options.Resources)

	for _, ref := range unsupportedRefs {
		// Leave the action unset: the recorder treats FileActionIgnored
		// results as non-fatal, and we want the caller's bad reference to
		// escalate the job state.
		result := jobs.NewGroupKindResult(ref.Name, ref.Group, ref.Kind).
			WithError(fmt.Errorf("resource kind %q is not supported for export", ref.Kind))
		progress.Record(ctx, result.Build())
		if err := progress.TooManyErrors(); err != nil {
			return err
		}
	}

	if len(dashboardRefs) > 0 || len(folderRefs) > 0 {
		dashboardGVK := schema.GroupVersionKind{
			Group: resources.DashboardKind.Group,
			Kind:  resources.DashboardKind.Kind,
		}
		dashClient, dashGVR, err := clients.ForKind(ctx, dashboardGVK)
		if err != nil {
			return fmt.Errorf("get dashboard client: %w", err)
		}
		shim := newDashboardConversionShim(dashGVR, clients)

		if err := exportDashboardRefs(ctx, dashboardRefs, options, dashClient, shim, repositoryResources, progress, generateNewUIDs); err != nil {
			return err
		}

		if len(folderRefs) > 0 {
			if err := exportFolderRefs(ctx, folderRefs, options, dashClient, folderClient, shim, repositoryResources, progress, generateNewUIDs); err != nil {
				return err
			}
		}
	}

	return nil
}

// splitExportRefs partitions Resources into dashboard, folder, and
// unsupported buckets. The validator should reject unsupported kinds before
// admission, but we still classify them here so a request that bypasses
// admission produces a recorded error rather than a panic or silent skip.
func splitExportRefs(refs []provisioning.ResourceRef) (dashboards, folders, unsupported []provisioning.ResourceRef) {
	for _, ref := range refs {
		switch ref.Kind {
		case resources.DashboardKind.Kind:
			dashboards = append(dashboards, ref)
		case resources.FolderResourceKind:
			folders = append(folders, ref)
		default:
			unsupported = append(unsupported, ref)
		}
	}
	return
}

// exportDashboardRefs handles the per-dashboard Get + exportItem path. Each
// ref that fails to resolve (not found, transport error, or managed by another
// repository) records a non-Ignored error so the job state escalates.
func exportDashboardRefs(ctx context.Context,
	refs []provisioning.ResourceRef,
	options provisioning.ExportJobOptions,
	dashClient dynamic.ResourceInterface,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
) error {
	for _, ref := range refs {
		result := jobs.NewGroupKindResult(ref.Name, resources.DashboardKind.Group, resources.DashboardKind.Kind)

		item, err := dashClient.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				result.WithError(fmt.Errorf("dashboard %q not found", ref.Name))
			} else {
				result.WithError(fmt.Errorf("get dashboard %q: %w", ref.Name, err))
			}
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		if err := exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true); err != nil {
			return err
		}
	}
	return nil
}

// exportFolderRefs handles each Folder ref by computing its descendant
// folder UID set and exporting every dashboard whose grafana.app/folder
// annotation lands in that set. The folder hierarchy itself is emitted by
// ExportFolders before this runs, so we only need to walk dashboards here.
//
// Each ref is verified via Get so a missing or another-repo-managed folder
// produces a recorded error and escalates the job. Dashboards inside an
// explicitly-requested folder use the explicitlyRequested=true write path:
// if a dashboard inside the folder is managed by a different repository, the
// caller asked for that folder's contents, so it's a per-dashboard failure
// rather than a silent skip.
func exportFolderRefs(ctx context.Context,
	refs []provisioning.ResourceRef,
	options provisioning.ExportJobOptions,
	dashClient dynamic.ResourceInterface,
	folderClient dynamic.ResourceInterface,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
) error {
	progress.SetMessage(ctx, "load folder tree for selective export")

	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}
		// Skip folders managed by any other source so the subtree only contains
		// folders the caller could legitimately export.
		if manager, _ := meta.GetManagerProperties(); manager.Identity != "" {
			return nil
		}
		return tree.AddUnstructured(item)
	}); err != nil {
		return fmt.Errorf("load folder tree: %w", err)
	}

	rootIDs := make([]string, 0, len(refs))
	for _, ref := range refs {
		result := jobs.NewGroupKindResult(ref.Name, resources.FolderResourceGroup, resources.FolderResourceKind)

		// A folder absent from the unmanaged listing is either missing, managed
		// elsewhere, or an API error: differentiate via Get so the recorded
		// error is accurate. Folders present in the listing are unmanaged by
		// construction (the loop above filtered managed ones out).
		if _, ok := tree.Get(ref.Name); !ok {
			item, gErr := folderClient.Get(ctx, ref.Name, metav1.GetOptions{})
			if gErr != nil {
				if apierrors.IsNotFound(gErr) {
					result.WithError(fmt.Errorf("folder %q not found", ref.Name))
				} else {
					result.WithError(fmt.Errorf("get folder %q: %w", ref.Name, gErr))
				}
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
			meta, mErr := utils.MetaAccessor(item)
			if mErr != nil {
				result.WithError(fmt.Errorf("extract meta accessor for folder %q: %w", ref.Name, mErr))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
			if manager, _ := meta.GetManagerProperties(); manager.Identity != "" {
				result.WithError(fmt.Errorf("folder %q is managed by %q and cannot be exported", ref.Name, manager.Identity))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
			// Folder exists and is unmanaged but missed our list (possible if it
			// was created between ForEach and Get). Treat it as a singleton root
			// — its descendants would not have appeared in the list either.
			if err := tree.AddUnstructured(item); err != nil {
				result.WithError(fmt.Errorf("add folder %q to tree: %w", ref.Name, err))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}
		}

		rootIDs = append(rootIDs, ref.Name)
	}

	if len(rootIDs) == 0 {
		return nil
	}

	subtree, missing, err := resources.CollectSubtreeIDs(ctx, tree, rootIDs)
	if err != nil {
		return fmt.Errorf("collect folder subtree: %w", err)
	}
	// CollectSubtreeIDs reports roots that fell out of the tree between Get
	// and the BFS walk. We already recorded errors for refs that never made
	// it into rootIDs, so this should normally be empty; record any survivors
	// so the job still surfaces them rather than silently dropping.
	for _, id := range missing {
		result := jobs.NewGroupKindResult(id, resources.FolderResourceGroup, resources.FolderResourceKind).
			WithError(fmt.Errorf("folder %q disappeared during export", id))
		progress.Record(ctx, result.Build())
		if err := progress.TooManyErrors(); err != nil {
			return err
		}
	}

	progress.SetMessage(ctx, "export dashboards in selected folders")
	return resources.ForEach(ctx, dashClient, func(item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}
		if _, in := subtree[meta.GetFolder()]; !in {
			return nil
		}
		return exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true)
	})
}

func exportResource(ctx context.Context,
	options provisioning.ExportJobOptions,
	client dynamic.ResourceInterface,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
) error {
	// FIXME: using k8s list will force evrything into one version -- we really want the original saved version
	// this will work well enough for now, but needs to be revisted as we have a bigger mix of active versions
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		return exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, false)
	})
}

// exportItem writes a single resource to the repository, applying the shared
// ignore/shim/UID-regen rules. When explicitlyRequested is true, a managed
// resource produces an error: the caller named a dashboard that cannot be
// exported, so the job should surface that failure rather than silently
// dropping it. The bulk path keeps the quiet ignore since encountering
// managed resources is expected when iterating the whole namespace.
func exportItem(ctx context.Context,
	item *unstructured.Unstructured,
	options provisioning.ExportJobOptions,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
	explicitlyRequested bool,
) error {
	gvk := item.GroupVersionKind()
	name := item.GetName()
	resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(repository.FileActionCreated)

	meta, err := utils.MetaAccessor(item)
	if err != nil {
		metaError := fmt.Errorf("extracting meta accessor for resource %s: %w", name, err)
		resultBuilder.WithAction(repository.FileActionIgnored).WithError(metaError)
		progress.Record(ctx, resultBuilder.Build())
		return nil
	}

	manager, _ := meta.GetManagerProperties()
	if manager.Identity != "" {
		if explicitlyRequested {
			// Leave the default action in place: the recorder discards errors
			// on FileActionIgnored results, and we want this failure to count.
			resultBuilder.WithError(fmt.Errorf("dashboard %q is managed by %q and cannot be exported", name, manager.Identity))
			progress.Record(ctx, resultBuilder.Build())
			return progress.TooManyErrors()
		}
		resultBuilder.WithAction(repository.FileActionIgnored)
		progress.Record(ctx, resultBuilder.Build())
		return nil
	}

	if shim != nil {
		item, err = shim(ctx, item)
	}

	if err == nil && generateNewUIDs {
		item = item.DeepCopy()
		item.SetName(grafanautil.GenerateShortUID())
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
	return progress.TooManyErrors()
}

// newDashboardConversionShim returns a conversionShim that preserves each
// dashboard's original apiVersion when the default v1 response has
// lossy-converted fields. For v0 the stored model is simply restored via
// apiVersion rewrite; for other stored versions we re-Get through a cached
// dynamic client keyed on the version string.
func newDashboardConversionShim(gvr schema.GroupVersionResource, clients resources.ResourceClients) conversionShim {
	versionClients := make(map[string]dynamic.ResourceInterface)
	return func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
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
			versionClient, ok := versionClients[storedVersion]
			if !ok {
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
}
