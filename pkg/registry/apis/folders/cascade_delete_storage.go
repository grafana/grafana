package folders

import (
	"context"
	"errors"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Cascade-delete labels/finalizer are defined in foldersv1 as the shared contract with the reconciler.
const (
	folderTerminatingLabel       = foldersv1.LabelTerminating
	folderTerminatingLabelValue  = foldersv1.LabelValueTrue
	folderCascadeDeleteFinalizer = foldersv1.FinalizerCascadeDelete
)

// childFolderPageSize bounds each search page when enumerating child folders or dashboards.
var childFolderPageSize int64 = 1000

var _ grafanarest.Storage = (*cascadeDeleteStorage)(nil)

// FolderContentsDeleter deletes the non-dashboard resources in a folder (alert rules, library
// elements) during cascade delete. Satisfied by *cleaner.ContentsCleaner; kept as an interface here
// so the cascade can be faked in tests and the cleaner package need not import the apiserver.
type FolderContentsDeleter interface {
	DeleteInFolder(ctx context.Context, namespace, folderUID string) error
}

// cascadeDeleteStorage wraps the folder storage and overrides Delete to recursively remove a
// folder's subtree; all other REST methods are promoted from the embedded storage.
type cascadeDeleteStorage struct {
	grafanarest.Storage
	searcher resourcepb.ResourceIndexClient
	// dashboardClient resolves the dashboard apiserver client; nil when none is configured, in which
	// case dashboard cleanup is skipped.
	dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)
	// contentsDeleter removes alert rules and library elements in each folder; nil when not wired
	// (e.g. MT), in which case that cleanup is skipped.
	contentsDeleter FolderContentsDeleter
	// accessClient authorizes the requester against contained resources before the cascade; nil skips
	// the pre-flight (e.g. tests).
	accessClient authlib.AccessClient
}

// newCascadeDeleteStorage wraps store, re-exposing the watch/deletecollection interfaces the wrapper
// would otherwise hide. The wrapped store implements both (MT generic store) or neither
// (folderStorage), so one check keeps the advertised verbs unchanged.
func newCascadeDeleteStorage(store grafanarest.Storage, searcher resourcepb.ResourceIndexClient, dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error), contentsDeleter FolderContentsDeleter, accessClient authlib.AccessClient) grafanarest.Storage {
	base := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: dashboardClient, contentsDeleter: contentsDeleter, accessClient: accessClient}
	watcher, hasWatch := store.(rest.Watcher)
	collectionDeleter, hasCollectionDelete := store.(rest.CollectionDeleter)
	if hasWatch && hasCollectionDelete {
		return &struct {
			*cascadeDeleteStorage
			rest.Watcher
			rest.CollectionDeleter
		}{base, watcher, cascadeCollectionDeleter{inner: collectionDeleter}}
	}
	return base
}

// cascadeCollectionDeleter rejects forced collection deletes (which would bypass the per-folder
// cascade and orphan children/dashboards) and otherwise forwards to the wrapped store.
type cascadeCollectionDeleter struct {
	inner rest.CollectionDeleter
}

func (c cascadeCollectionDeleter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	if kubernetesFolderCascadeDeleteEnabled(ctx) && forceDeleteFromDeleteOptions(options) {
		return nil, apierrors.NewBadRequest("forced collection delete is not supported with folder cascade delete; delete folders individually")
	}
	return c.inner.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// Delete removes a folder and, when cascade delete is enabled, its entire subtree. The subtree is
// walked depth-first: each folder is stamped with a terminating label on the way down, and folders
// are deleted on the way back up once they have no remaining child folders (i.e. leaves first).
func (s *cascadeDeleteStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// Delegate when the cascade flag is disabled or the user is not forcing the deletion
	if !kubernetesFolderCascadeDeleteEnabled(ctx) || !forceDeleteFromDeleteOptions(options) {
		return s.Storage.Delete(ctx, name, deleteValidation, options)
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	// Validate and check preconditions up-front, as the requesting user, before any destructive
	// cascade.
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, obj); err != nil {
			return nil, false, err
		}
	}
	if err := checkDeletePreconditions(obj, options); err != nil {
		return nil, false, err
	}

	// Async cascade: stamp the finalizer + terminating label and delegate. With a finalizer present
	// the generic store records deletionTimestamp and keeps the folder for the background reconciler.
	// Validation already ran above, but the graceful-deletion path dereferences deleteValidation
	// unconditionally, so pass the admit-everything func rather than nil.
	if folderCascadeDeleteAsyncEnabled(ctx) {
		if err := s.markTerminating(ctx, name, options, true); err != nil {
			return nil, false, err
		}
		return s.Storage.Delete(ctx, name, rest.ValidateAllObjectFunc, options)
	}

	// Capture the requester before switching to the service identity, so the per-folder access checks
	// in the cascade run as the user rather than the service.
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	rootParent := ""
	if meta, mErr := utils.MetaAccessor(obj); mErr == nil {
		rootParent = meta.GetFolder()
	}

	// Run the cascade under a service identity: searcher.Search is GET-scoped to the requester, so a
	// user authorized to force-delete the folder but not to see every contained resource would
	// otherwise enumerate (and thus delete) only the visible subset, orphaning the rest.
	cascadeCtx := identity.WithServiceIdentityContext(ctx, ns.OrgID)
	return s.cascadeDelete(cascadeCtx, user, ns.Value, rootParent, name, cascadeDeleteOptions(options), true)
}

// cascadeDeleteOptions returns the options reused for descendant deletes, carrying only the
// cascade-relevant fields (dry-run and grace period). Folder-specific fields like preconditions are
// dropped so they aren't applied to children, whose uid/resourceVersion differ from the root.
func cascadeDeleteOptions(options *metav1.DeleteOptions) *metav1.DeleteOptions {
	out := &metav1.DeleteOptions{}
	if options != nil {
		out.DryRun = options.DryRun
		out.GracePeriodSeconds = options.GracePeriodSeconds
	}
	return out
}

// checkDeletePreconditions enforces DeleteOptions.Preconditions (uid/resourceVersion) against obj.
func checkDeletePreconditions(obj runtime.Object, options *metav1.DeleteOptions) error {
	if options == nil || options.Preconditions == nil {
		return nil
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	gr := foldersv1.FolderResourceInfo.GroupResource()
	pre := options.Preconditions
	if pre.UID != nil && *pre.UID != meta.GetUID() {
		return apierrors.NewConflict(gr, meta.GetName(), fmt.Errorf("precondition uid %q does not match %q", *pre.UID, meta.GetUID()))
	}
	if pre.ResourceVersion != nil && *pre.ResourceVersion != meta.GetResourceVersion() {
		return apierrors.NewConflict(gr, meta.GetName(), fmt.Errorf("precondition resourceVersion %q does not match %q", *pre.ResourceVersion, meta.GetResourceVersion()))
	}
	return nil
}

// cascadeDelete deletes the folder and its descendants depth-first (validation already ran in
// Delete).
//
// requested param marks whether we are deleting the requested folder or not. We suppress
// NotFound errors for children, since they might be already deleted or a stale search-index entry,
// but we keep the error for the user-requested folder.
func (s *cascadeDeleteStorage) cascadeDelete(ctx context.Context, user identity.Requester, namespace, parentUID, name string, options *metav1.DeleteOptions, requested bool) (runtime.Object, bool, error) {
	if err := s.markTerminating(ctx, name, options, false); err != nil {
		if apierrors.IsNotFound(err) && !requested {
			return nil, false, nil
		}
		return nil, false, err
	}

	// Authorize the requester to delete this folder's alert rules and library elements, mirroring the
	// per-folder permissions legacy enforced. Runs after the NotFound skip so a stale or already-deleted
	// child folder is skipped idempotently instead of 403-ing on an un-walkable inheritance chain.
	if err := s.checkFolderContentsAccess(ctx, user, namespace, name, parentUID); err != nil {
		return nil, false, err
	}

	children, err := s.childFolders(ctx, namespace, name)
	if err != nil {
		return nil, false, err
	}

	for _, child := range children {
		if _, _, err := s.cascadeDelete(ctx, user, namespace, name, child, options, false); err != nil {
			return nil, false, err
		}
	}

	// Remove the dashboards contained directly in this folder before deleting the folder itself.
	if err := s.deleteDashboardsInFolder(ctx, namespace, name, options); err != nil {
		return nil, false, err
	}

	// Then the alert rules and library elements in this folder. Runs in the request path so a
	// failure aborts the cascade, same as the dashboard sweep above. Skipped on dry-run: the
	// RegistryService cleanups mutate the DB directly and have no dry-run mode.
	if s.contentsDeleter != nil && len(options.DryRun) == 0 {
		if err := s.contentsDeleter.DeleteInFolder(ctx, namespace, name); err != nil {
			// Surface a permission failure as 403 rather than a generic 500, so the client sees why.
			if errors.Is(err, folder.ErrAccessDenied) {
				return nil, false, apierrors.NewForbidden(foldersv1.FolderResourceInfo.GroupResource(), name, err)
			}
			return nil, false, err
		}
	} else {
		logging.FromContext(ctx).Debug("Skipping in-process alert rule and library element cleanup",
			"folder", name, "has_contents_deleter", s.contentsDeleter != nil, "dry_run", len(options.DryRun) > 0)
	}

	// Delete this folder last. NotFound is success for children (idempotent), but the requested
	// folder keeps its missing-resource error.
	obj, async, err := s.Storage.Delete(ctx, name, nil, options)
	if apierrors.IsNotFound(err) && !requested {
		return obj, async, nil
	}
	return obj, async, err
}

// deleteDashboardsInFolder deletes every dashboard in folderUID via the dashboard apiserver (so its
// hooks run). A NotFound is treated as already-done, keeping the sweep idempotent and resumable.
func (s *cascadeDeleteStorage) deleteDashboardsInFolder(ctx context.Context, namespace, folderUID string, options *metav1.DeleteOptions) error {
	svc, err := s.dashboardClient(ctx)
	if err != nil {
		return fmt.Errorf("get dashboard client: %w", err)
	}
	if svc == nil {
		// No dashboard apiserver client configured (e.g. legacy mode); nothing to clean up here.
		return nil
	}
	client := (*svc).Namespace(namespace)

	// options are already the sanitized cascade options (dry-run + grace period only).
	dashOpts := cascadeDeleteOptions(options)

	// Enumerate fully before deleting: offset paging is only valid against a stable collection, and
	// deleting mid-pagination would shift later pages and skip dashboards.
	names, err := s.dashboardsInFolder(ctx, namespace, folderUID)
	if err != nil {
		return err
	}

	for _, name := range names {
		if err := client.Delete(ctx, name, *dashOpts); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("delete dashboard %q: %w", name, err)
		}
	}
	return nil
}

// dashboardsInFolder lists the names of all dashboards whose grafana.app/folder annotation points at
// folderUID, paging through the search results.
func (s *cascadeDeleteStorage) dashboardsInFolder(ctx context.Context, namespace, folderUID string) ([]string, error) {
	gvr := dashv1.DashboardResourceInfo.GroupVersionResource()

	var (
		names  []string
		offset int64
	)
	for {
		resp, err := s.searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: namespace,
					Group:     gvr.Group,
					Resource:  gvr.Resource,
				},
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_FOLDER,
					Operator: string(selection.Equals),
					Values:   []string{folderUID},
				}},
			},
			Limit:  childFolderPageSize,
			Offset: offset,
		})
		if err != nil {
			return nil, fmt.Errorf("search dashboards in folder %q: %w", folderUID, err)
		}
		if resp.Error != nil {
			return nil, fmt.Errorf("search dashboards in folder %q: %s", folderUID, resp.Error.Message)
		}
		if resp.Results == nil || len(resp.Results.Rows) == 0 {
			return names, nil
		}

		for _, row := range resp.Results.Rows {
			if row.Key != nil {
				names = append(names, row.Key.Name)
			}
		}

		// The bleve Search path drives pagination off TotalHits + offset rather than a page token.
		// Advance by the rows actually returned so a short page doesn't skip the remainder.
		offset += int64(len(resp.Results.Rows))
		if offset >= resp.TotalHits {
			return names, nil
		}
	}
}

// markTerminating stamps the terminating label on the folder so the in-progress subtree deletion is
// observable before its leaves are removed. When withFinalizer is set it also adds the cascade
// finalizer, which keeps the folder alive after delete for the background reconciler. Honors dry-run.
func (s *cascadeDeleteStorage) markTerminating(ctx context.Context, name string, options *metav1.DeleteOptions, withFinalizer bool) error {
	objInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, newObj, oldObj runtime.Object) (runtime.Object, error) {
		// With a nil base object, DefaultUpdatedObjectInfo passes a nil newObj; mutate a copy of the
		// existing folder instead.
		obj := newObj
		if obj == nil {
			obj = oldObj.DeepCopyObject()
		}
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}
		labels := meta.GetLabels()
		if labels == nil {
			labels = map[string]string{}
		}
		labels[folderTerminatingLabel] = folderTerminatingLabelValue
		meta.SetLabels(labels)
		if withFinalizer {
			addFinalizer(meta, folderCascadeDeleteFinalizer)
		}
		return obj, nil
	})

	updateOpts := &metav1.UpdateOptions{}
	if options != nil {
		updateOpts.DryRun = options.DryRun
	}
	_, _, err := s.Update(ctx, name, objInfo, nil, nil, false, updateOpts)
	return err
}

// addFinalizer appends finalizer to meta unless it is already present.
func addFinalizer(meta utils.GrafanaMetaAccessor, finalizer string) {
	if slices.Contains(meta.GetFinalizers(), finalizer) {
		return
	}
	meta.SetFinalizers(append(meta.GetFinalizers(), finalizer))
}

// childFolders returns the UIDs of all direct child folders of parentUID, paging through the search
// results.
func (s *cascadeDeleteStorage) childFolders(ctx context.Context, namespace, parentUID string) ([]string, error) {
	var (
		all     []string
		offset  int64
		hasMore = true
	)

	for hasMore {
		children, more, err := getChildrenBatch(ctx, s.searcher, namespace, []string{parentUID}, childFolderPageSize, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, children...)
		hasMore = more
		// Advance by the rows actually returned so a short page doesn't skip the remainder.
		offset += int64(len(children))
	}

	return all, nil
}

// Legacy folder delete gated contained resources on alert.rules:delete and folders:write; the authz
// mapper resolves the tuples below to those actions (see pkg/services/authz/rbac/mapper.go).
const (
	cascadeAlertRuleGroup    = "rules.alerting.grafana.app"
	cascadeAlertRuleResource = "alertrules"
)

// checkFolderContentsAccess denies the delete unless the requester may delete the alert rules
// (alert.rules:delete) and library elements (folders:write) in folderUID; parentUID lets folder
// permissions resolve through inheritance. No-op when no access client is wired (e.g. tests).
func (s *cascadeDeleteStorage) checkFolderContentsAccess(ctx context.Context, user identity.Requester, namespace, folderUID, parentUID string) error {
	if s.accessClient == nil {
		return nil
	}
	logging.FromContext(ctx).Debug("Evaluating contained-resource delete permissions", "folder", folderUID)
	folderGVR := foldersv1.FolderResourceInfo.GroupVersionResource()
	// Root folders carry an empty parent annotation; RBAC treats "" as no folder context, so a user
	// who only inherits folders:write from General would be wrongly denied. Normalize to General.
	writeParent := parentUID
	if writeParent == "" {
		writeParent = folder.GeneralFolderUID
	}
	// One homogeneous Check per resource: a mixed-resource BatchCheck is routed back to RBAC in
	// Zanzana rollout mode, so tenants mid-rollout would be evaluated by the wrong engine.
	checks := []struct {
		req    authlib.CheckRequest
		folder string
	}{
		{authlib.CheckRequest{Namespace: namespace, Verb: utils.VerbDelete, Group: cascadeAlertRuleGroup, Resource: cascadeAlertRuleResource}, folderUID},
		{authlib.CheckRequest{Namespace: namespace, Verb: utils.VerbUpdate, Group: folderGVR.Group, Resource: folderGVR.Resource, Name: folderUID}, writeParent},
	}
	for _, c := range checks {
		resp, err := s.accessClient.Check(ctx, user, c.req, c.folder)
		if err != nil {
			return err
		}
		if !resp.Allowed {
			return apierrors.NewForbidden(foldersv1.FolderResourceInfo.GroupResource(), folderUID, folder.ErrAccessDenied)
		}
	}
	return nil
}
