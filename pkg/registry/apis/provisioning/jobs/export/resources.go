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
	for _, supported := range clients.SupportedResources() {
		// skip folders as we do them first... so only non-folder kinds here
		if supported.GroupKind == resources.FolderKind.GroupKind() {
			continue
		}

		// Resolve the preferred version + plural resource via discovery.
		client, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: supported.Group, Kind: supported.Kind})
		if err != nil {
			return fmt.Errorf("get client for %s: %w", supported.Kind, err)
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", gvr.Resource))

		// When requesting dashboards over the v1 api, we want to keep the original apiVersion if conversion fails
		var shim conversionShim
		if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
			shim = newDashboardConversionShim(gvr, clients)
		}

		if err := exportResource(ctx, options, client, shim, repositoryResources, progress, generateNewUIDs); err != nil {
			return fmt.Errorf("export %s: %w", gvr.Resource, err)
		}
	}

	return nil
}

// ExportSpecificResources exports the explicit list of resources named in
// options.Resources. It shares the per-item write path with ExportResources
// (manager-identity skip, conversion shim, UID regeneration) but resolves
// items via Get rather than listing the namespace.
//
// Two kinds of reference are handled:
//   - Folder: the folder itself, every descendant folder, and every unmanaged
//     folder-scoped resource inside the subtree. The folder's own ancestor
//     chain is materialized so the subtree lands at its natural path rather
//     than the repository root.
//   - Any other configured kind (dashboard, playlist, …): a single resource
//     fetched by UID and resolved against its own kind/group via discovery.
//     Its ancestor folder chain is materialized so it lands at its natural
//     path; unrelated folders are NOT emitted.
//
// A reference whose kind cannot be resolved is recorded as a failed item so a
// misconfigured caller surfaces in the job summary rather than silently
// failing.
func ExportSpecificResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, folderClient dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	progress.SetMessage(ctx, "start selective resource export")

	folderRefs, otherRefs := splitFolderRefs(options.Resources)
	if len(folderRefs) == 0 && len(otherRefs) == 0 {
		return nil
	}

	// Load the unmanaged folder tree once: non-folder refs use it to walk their
	// ancestor chain, folder refs use it to compute the descendant subtree.
	// Managed folders are filtered out so we never write over a folder owned by
	// another repository.
	progress.SetMessage(ctx, "load folder tree for selective export")
	folderTree, err := loadUnmanagedFolderTree(ctx, folderClient)
	if err != nil {
		return err
	}

	requiredFolders := make(map[string]struct{})

	// Resolve non-folder refs into items (any configured kind, via discovery).
	// Each resolved item's ancestor folder chain is added to requiredFolders so
	// the materialization step covers its natural path; seen tracks the resolved
	// identities so the folder-subtree scan below does not re-export them.
	resolvedItems, seen, err := resolveResourceRefs(ctx, otherRefs, clients, folderTree, progress, requiredFolders)
	if err != nil {
		return err
	}

	// Resolve folder refs into root UIDs. Each ref is verified to exist and to
	// be unmanaged. The ancestor chain of every accepted root is added to
	// requiredFolders so the subtree materializes at its natural path; the
	// subtree itself is collected via CollectSubtreeIDs and tracked separately
	// so the resource scan can filter by membership.
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

	// Write the resolved non-folder refs.
	for _, ri := range resolvedItems {
		if err := exportItem(ctx, ri.item, options, ri.shim, repositoryResources, progress, generateNewUIDs, true); err != nil {
			return err
		}
	}

	// Export every folder-scoped resource inside the requested subtrees.
	if len(folderRootIDs) > 0 {
		if err := exportSubtreeResources(ctx, clients, subtreeIDs, seen, options, repositoryResources, progress, generateNewUIDs); err != nil {
			return err
		}
	}

	return nil
}

// splitFolderRefs partitions Resources into Folder refs (handled recursively)
// and everything else (resolved individually against their own kind).
func splitFolderRefs(refs []provisioning.ResourceRef) (folders, others []provisioning.ResourceRef) {
	for _, ref := range refs {
		if ref.Kind == resources.FolderKind.Kind {
			folders = append(folders, ref)
		} else {
			others = append(others, ref)
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

// resolvedItem pairs an item resolved from an explicit reference with the
// conversion shim (if any) needed to write it in its stored apiVersion.
type resolvedItem struct {
	item *unstructured.Unstructured
	shim conversionShim
}

// resolveResourceRefs resolves each non-folder reference against its own
// kind/group via discovery, caching the per-kind client and (for dashboards)
// the conversion shim so repeated references to the same kind don't re-run
// discovery. Items that fail to resolve (unknown kind, not found, transport
// error) are recorded as non-Ignored errors so the job state escalates.
//
// For each resolved item the ancestor folder chain is added to requiredFolders
// so the materialization step covers its natural path. The returned seen set
// (keyed by group/kind/name) lets the folder-subtree scan skip resources that
// were already written via an explicit reference.
func resolveResourceRefs(ctx context.Context,
	refs []provisioning.ResourceRef,
	clients resources.ResourceClients,
	folderTree resources.FolderTree,
	progress jobs.JobProgressRecorder,
	requiredFolders map[string]struct{},
) ([]resolvedItem, map[string]struct{}, error) {
	type resolvedKind struct {
		client dynamic.ResourceInterface
		gvr    schema.GroupVersionResource
		shim   conversionShim
	}
	clientsByKind := make(map[schema.GroupVersionKind]resolvedKind)
	items := make([]resolvedItem, 0, len(refs))
	seen := make(map[string]struct{}, len(refs))

	for _, ref := range refs {
		result := jobs.NewGroupKindResult(ref.Name, ref.Group, ref.Kind)
		gvk := schema.GroupVersionKind{Group: ref.Group, Kind: ref.Kind}

		rk, ok := clientsByKind[gvk]
		if !ok {
			client, gvr, err := clients.ForKind(ctx, gvk)
			if err != nil {
				result.WithError(fmt.Errorf("resolve client for kind %q: %w", kindLabel(ref.Kind), err))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return nil, nil, err
				}
				continue
			}
			rk = resolvedKind{client: client, gvr: gvr}
			// Dashboards may need their original apiVersion preserved on export.
			if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
				rk.shim = newDashboardConversionShim(gvr, clients)
			}
			clientsByKind[gvk] = rk
		}

		item, err := rk.client.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				result.WithError(fmt.Errorf("%s %q not found", kindLabel(ref.Kind), ref.Name))
			} else {
				result.WithError(fmt.Errorf("get %s %q: %w", kindLabel(ref.Kind), ref.Name, err))
			}
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return nil, nil, err
			}
			continue
		}

		items = append(items, resolvedItem{item: item, shim: rk.shim})
		seen[resourceKey(rk.gvr.Group, ref.Kind, item.GetName())] = struct{}{}

		// Collect the ancestor folder chain so the materialization step writes
		// the directories the item's natural path depends on. A MetaAccessor
		// failure here is non-fatal: exportItem surfaces it on the write.
		if meta, mErr := utils.MetaAccessor(item); mErr == nil {
			for _, id := range resources.CollectAncestorIDs(folderTree, meta.GetFolder()) {
				requiredFolders[id] = struct{}{}
			}
		}
	}
	return items, seen, nil
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

// exportSubtreeResources walks every folder-scoped supported resource kind and
// exports each item whose folder annotation lands inside one of the requested
// subtrees. Items already written via an explicit ref (in seen) are skipped so
// a resource named both directly and via its folder is not exported twice.
func exportSubtreeResources(ctx context.Context,
	clients resources.ResourceClients,
	subtreeIDs map[string]struct{},
	seen map[string]struct{},
	options provisioning.ExportJobOptions,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
) error {
	progress.SetMessage(ctx, "export resources in selected folders")
	for _, supported := range clients.SupportedResources() {
		// Folders themselves are materialized via the scoped tree; only their
		// folder-scoped contents are exported here.
		if supported.GroupKind == resources.FolderKind.GroupKind() || !supported.IsFolderScoped() {
			continue
		}

		client, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: supported.Group, Kind: supported.Kind})
		if err != nil {
			return fmt.Errorf("get client for %s: %w", supported.Kind, err)
		}
		var shim conversionShim
		if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
			shim = newDashboardConversionShim(gvr, clients)
		}

		if err := resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			meta, err := utils.MetaAccessor(item)
			if err != nil {
				// Mirror exportItem's MetaAccessor handling: record the failure
				// as an Ignored result and keep going. Returning the error here
				// would abort the scan over a single malformed resource.
				result := jobs.NewGVKResult(item.GetName(), item.GroupVersionKind()).
					WithAction(repository.FileActionIgnored).
					WithError(fmt.Errorf("extract meta accessor for %s %s: %w", kindLabel(supported.Kind), item.GetName(), err))
				progress.Record(ctx, result.Build())
				return nil
			}
			if _, in := subtreeIDs[meta.GetFolder()]; !in {
				return nil
			}
			if _, already := seen[resourceKey(supported.Group, supported.Kind, item.GetName())]; already {
				return nil
			}
			return exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true)
		}); err != nil {
			return fmt.Errorf("export %s in selected folders: %w", gvr.Resource, err)
		}
	}
	return nil
}

// materializeScopedFolders writes only the folders in requiredFolders to the
// repository (and registers them in the FolderManager's tree so subsequent
// resource writes resolve their paths). Each folder write is recorded via
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

// resourceKey builds the dedupe key shared between the explicit-ref pass and
// the folder-subtree scan: group + kind + name uniquely identifies a resource.
func resourceKey(group, kind, name string) string {
	return group + "/" + kind + "/" + name
}

// kindLabel returns a human-readable label for a resource kind, falling back to
// a generic noun when the kind is unset so user-facing messages still read
// correctly.
func kindLabel(kind string) string {
	if kind == "" {
		return "resource"
	}
	return kind
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
// resource produces an error: the caller named a resource that cannot be
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

	// Derive a human name from the item's kind so user-facing messages read
	// correctly for any exported resource, not just dashboards.
	kindName := kindLabel(gvk.Kind)

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
			resultBuilder.WithError(fmt.Errorf("%s %q is managed by %q and cannot be exported", kindName, name, manager.Identity))
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
