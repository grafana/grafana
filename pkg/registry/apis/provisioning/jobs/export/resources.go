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
//   - Dashboard: a single dashboard fetched by UID. Its ancestor folder chain
//     is materialized in the repository so the dashboard's natural path
//     resolves; unrelated folders are NOT emitted.
//   - Folder: the folder itself, every descendant folder, and every unmanaged
//     dashboard inside the subtree. The folder's own ancestor chain is
//     materialized so the subtree lands at its natural path rather than the
//     repository root.
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

	if len(dashboardRefs) == 0 && len(folderRefs) == 0 {
		return nil
	}

	dashboardGVK := schema.GroupVersionKind{
		Group: resources.DashboardKind.Group,
		Kind:  resources.DashboardKind.Kind,
	}
	dashClient, dashGVR, err := clients.ForKind(ctx, dashboardGVK)
	if err != nil {
		return fmt.Errorf("get dashboard client: %w", err)
	}
	shim := newDashboardConversionShim(dashGVR, clients)

	// Load the unmanaged folder tree once: dashboard refs use it to walk
	// their ancestor chain, folder refs use it to compute the descendant
	// subtree. Managed folders are filtered out so we never try to write
	// over a folder owned by another repository.
	progress.SetMessage(ctx, "load folder tree for selective export")
	folderTree, err := loadUnmanagedFolderTree(ctx, folderClient)
	if err != nil {
		return err
	}

	// Resolve dashboard refs into items. Failures are recorded per-ref and
	// the rest of the export proceeds; ancestor folders of resolved
	// dashboards are tracked so the materialization step below covers them.
	dashboardItems, requiredFolders, err := resolveDashboardRefs(ctx, dashboardRefs, folderTree, dashClient, progress)
	if err != nil {
		return err
	}

	// Resolve folder refs into root UIDs. Each ref is verified to exist and
	// to be unmanaged. The ancestor chain of every accepted root is added to
	// requiredFolders so the subtree materializes at its natural path; the
	// subtree itself is collected via CollectSubtreeIDs and tracked separately
	// so the dashboard scan can filter by membership.
	folderRootIDs, err := resolveFolderRefs(ctx, folderRefs, folderTree, folderClient, progress, requiredFolders)
	if err != nil {
		return err
	}

	subtreeIDs, missing, err := resources.CollectSubtreeIDs(ctx, folderTree, folderRootIDs)
	if err != nil {
		return fmt.Errorf("collect folder subtree: %w", err)
	}
	for _, id := range missing {
		// CollectSubtreeIDs reports roots that fell out between Get and the
		// BFS walk; record so the job surfaces them rather than dropping.
		result := jobs.NewGroupKindResult(id, resources.FolderResource.Group, resources.FolderKind.Kind).
			WithError(fmt.Errorf("folder %q disappeared during export", id))
		progress.Record(ctx, result.Build())
		if err := progress.TooManyErrors(); err != nil {
			return err
		}
	}
	for id := range subtreeIDs {
		requiredFolders[id] = struct{}{}
	}

	// Materialize only the folders required by the requested resources. The
	// scoped tree carries each folder's original parent pointer, so as long as
	// requiredFolders covers the full ancestor chain for every UID it includes
	// (which it does by construction above), the walk produces correct paths.
	if len(requiredFolders) > 0 {
		if err := materializeScopedFolders(ctx, folderTree, requiredFolders, options, repositoryResources, progress); err != nil {
			return err
		}
	}

	// Write resolved dashboard refs and remember their UIDs so the folder-scan
	// pass below does not re-export them. Without this dedupe a request that
	// mixes a Dashboard ref and a Folder ref containing that same dashboard
	// would write the dashboard twice — and with generateNewUIDs=true each
	// pass would generate a different metadata.name, producing two distinct
	// repository files for the same source dashboard.
	exportedDashboardUIDs := make(map[string]struct{}, len(dashboardItems))
	for _, item := range dashboardItems {
		exportedDashboardUIDs[item.GetName()] = struct{}{}
		if err := exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true); err != nil {
			return err
		}
	}

	// Walk all dashboards once and write any whose folder annotation lands in
	// a requested subtree. Skip UIDs already written via an explicit Dashboard
	// ref above so the subtree pass cannot duplicate or shadow them.
	if len(folderRootIDs) > 0 {
		progress.SetMessage(ctx, "export dashboards in selected folders")
		if err := resources.ForEach(ctx, dashClient, func(item *unstructured.Unstructured) error {
			if _, already := exportedDashboardUIDs[item.GetName()]; already {
				return nil
			}
			meta, err := utils.MetaAccessor(item)
			if err != nil {
				return fmt.Errorf("extract meta accessor: %w", err)
			}
			if _, in := subtreeIDs[meta.GetFolder()]; !in {
				return nil
			}
			return exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true)
		}); err != nil {
			return err
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
		case resources.FolderKind.Kind:
			folders = append(folders, ref)
		default:
			unsupported = append(unsupported, ref)
		}
	}
	return
}

// loadUnmanagedFolderTree lists every unmanaged folder in the namespace and
// returns a FolderTree keyed on UID. Folders managed by another source are
// filtered out so the caller never builds a scoped tree that would try to
// re-write someone else's folder.
func loadUnmanagedFolderTree(ctx context.Context, folderClient dynamic.ResourceInterface) (resources.FolderTree, error) {
	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}
		if manager, _ := meta.GetManagerProperties(); manager.Identity != "" {
			return nil
		}
		return tree.AddUnstructured(item)
	}); err != nil {
		return nil, fmt.Errorf("load folder tree: %w", err)
	}
	return tree, nil
}

// resolveDashboardRefs Get-fetches every Dashboard ref. Items that fail to
// resolve (not found, transport error, mismatched group) are recorded as
// non-Ignored errors so the job state escalates. For each resolved dashboard
// the ancestor folder chain is added to the requiredFolders set so the
// materialization step covers the dashboard's natural path.
func resolveDashboardRefs(ctx context.Context,
	refs []provisioning.ResourceRef,
	folderTree resources.FolderTree,
	dashClient dynamic.ResourceInterface,
	progress jobs.JobProgressRecorder,
) ([]*unstructured.Unstructured, map[string]struct{}, error) {
	requiredFolders := make(map[string]struct{})
	resolved := make([]*unstructured.Unstructured, 0, len(refs))
	for _, ref := range refs {
		result := jobs.NewGroupKindResult(ref.Name, resources.DashboardKind.Group, resources.DashboardKind.Kind)

		// Defense in depth: admission rejects mismatched kind/group pairs, but
		// a request that bypasses admission must not be silently processed
		// against the wrong resource type.
		if ref.Group != "" && ref.Group != resources.DashboardResource.Group {
			result.WithError(fmt.Errorf("dashboard ref %q has group %q; expected %q", ref.Name, ref.Group, resources.DashboardResource.Group))
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return nil, nil, err
			}
			continue
		}

		item, err := dashClient.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				result.WithError(fmt.Errorf("dashboard %q not found", ref.Name))
			} else {
				result.WithError(fmt.Errorf("get dashboard %q: %w", ref.Name, err))
			}
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return nil, nil, err
			}
			continue
		}

		resolved = append(resolved, item)
		meta, mErr := utils.MetaAccessor(item)
		if mErr != nil {
			// MetaAccessor failure during ancestor collection is non-fatal:
			// exportItem will surface it on the write attempt.
			continue
		}
		for _, id := range resources.CollectAncestorIDs(folderTree, meta.GetFolder()) {
			requiredFolders[id] = struct{}{}
		}
	}
	return resolved, requiredFolders, nil
}

// resolveFolderRefs verifies each Folder ref against the loaded tree and via
// Get for refs missing from the unmanaged listing. Accepted refs return their
// UIDs so the caller can compute the descendant subtree; the ancestor chain of
// each accepted root is added to requiredFolders so its subtree materializes
// at its natural repository path rather than at the repo root.
func resolveFolderRefs(ctx context.Context,
	refs []provisioning.ResourceRef,
	folderTree resources.FolderTree,
	folderClient dynamic.ResourceInterface,
	progress jobs.JobProgressRecorder,
	requiredFolders map[string]struct{},
) ([]string, error) {
	rootIDs := make([]string, 0, len(refs))
	for _, ref := range refs {
		result := jobs.NewGroupKindResult(ref.Name, resources.FolderResource.Group, resources.FolderKind.Kind)

		// Defense in depth: admission rejects mismatched kind/group pairs, but
		// a request that bypasses admission must not be silently processed
		// against the wrong resource type.
		if ref.Group != "" && ref.Group != resources.FolderResource.Group {
			result.WithError(fmt.Errorf("folder ref %q has group %q; expected %q", ref.Name, ref.Group, resources.FolderResource.Group))
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return nil, err
			}
			continue
		}

		// A folder absent from the unmanaged listing is either missing, managed
		// elsewhere, or an API error: differentiate via Get so the recorded
		// error is accurate. Folders present in the listing are unmanaged by
		// construction (loadUnmanagedFolderTree filtered managed ones out).
		if _, ok := folderTree.Get(ref.Name); !ok {
			item, gErr := folderClient.Get(ctx, ref.Name, metav1.GetOptions{})
			if gErr != nil {
				if apierrors.IsNotFound(gErr) {
					result.WithError(fmt.Errorf("folder %q not found", ref.Name))
				} else {
					result.WithError(fmt.Errorf("get folder %q: %w", ref.Name, gErr))
				}
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return nil, err
				}
				continue
			}
			meta, mErr := utils.MetaAccessor(item)
			if mErr != nil {
				result.WithError(fmt.Errorf("extract meta accessor for folder %q: %w", ref.Name, mErr))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return nil, err
				}
				continue
			}
			if manager, _ := meta.GetManagerProperties(); manager.Identity != "" {
				result.WithError(fmt.Errorf("folder %q is managed by %q and cannot be exported", ref.Name, manager.Identity))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return nil, err
				}
				continue
			}
			// Folder exists and is unmanaged but missed our list (possible if it
			// was created between ForEach and Get). Treat it as a singleton root
			// — its descendants would not have appeared in the list either.
			if err := folderTree.AddUnstructured(item); err != nil {
				result.WithError(fmt.Errorf("add folder %q to tree: %w", ref.Name, err))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return nil, err
				}
				continue
			}
		}

		rootIDs = append(rootIDs, ref.Name)
		for _, id := range resources.CollectAncestorIDs(folderTree, ref.Name) {
			requiredFolders[id] = struct{}{}
		}
	}
	return rootIDs, nil
}

// materializeScopedFolders writes only the folders in requiredFolders to the
// repository (and registers them in the FolderManager's tree so subsequent
// dashboard writes resolve their paths). Each folder write is recorded via
// progress; a write failure escalates the job through the standard
// TooManyErrors path.
func materializeScopedFolders(ctx context.Context,
	src resources.FolderTree,
	requiredFolders map[string]struct{},
	options provisioning.ExportJobOptions,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	scoped := resources.ProjectSubset(src, requiredFolders)
	if scoped.Count() == 0 {
		return nil
	}
	progress.SetMessage(ctx, "write scoped folder tree to repository")
	err := repositoryResources.EnsureFolderTreeExists(ctx, options.Branch, options.Path, scoped, func(folder resources.Folder, created bool, err error) error {
		resultBuilder := jobs.NewFolderResult(folder.Path).WithName(folder.ID).WithAction(repository.FileActionCreated)
		if err != nil {
			resultBuilder.WithError(fmt.Errorf("creating folder %s at path %s: %w", folder.ID, folder.Path, err))
		}
		if !created {
			resultBuilder.WithAction(repository.FileActionIgnored)
		}
		progress.Record(ctx, resultBuilder.Build())
		return progress.TooManyErrors()
	})
	if err != nil {
		return fmt.Errorf("write scoped folders to repository: %w", err)
	}
	return nil
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
