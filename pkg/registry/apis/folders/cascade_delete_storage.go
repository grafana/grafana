package folders

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderTerminatingLabel is stamped on a folder once cascade deletion of its subtree has started.
const (
	folderTerminatingLabel      = "grafana.app/folder-terminating"
	folderTerminatingLabelValue = "true"
)

// childFolderPageSize bounds each search page when enumerating child folders or dashboards.
var childFolderPageSize int64 = 1000

var _ grafanarest.Storage = (*cascadeDeleteStorage)(nil)

// cascadeDeleteStorage wraps the folder storage and overrides Delete to recursively remove a
// folder's subtree; all other REST methods are promoted from the embedded storage.
type cascadeDeleteStorage struct {
	grafanarest.Storage
	searcher resourcepb.ResourceIndexClient
	// dashboardClient resolves the dashboard apiserver client; nil when none is configured, in which
	// case dashboard cleanup is skipped.
	dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)
}

// newCascadeDeleteStorage wraps store, re-exposing the watch/deletecollection interfaces the wrapper
// would otherwise hide. The wrapped store implements both (MT generic store) or neither
// (folderStorage), so one check keeps the advertised verbs unchanged.
func newCascadeDeleteStorage(store grafanarest.Storage, searcher resourcepb.ResourceIndexClient, dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)) grafanarest.Storage {
	base := &cascadeDeleteStorage{Storage: store, searcher: searcher, dashboardClient: dashboardClient}
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

	// Run the cascade under a service identity: searcher.Search is GET-scoped to the requester, so a
	// user authorized to force-delete the folder but not to see every contained resource would
	// otherwise enumerate (and thus delete) only the visible subset, orphaning the rest.
	cascadeCtx := identity.WithServiceIdentityContext(ctx, ns.OrgID)
	return s.cascadeDelete(cascadeCtx, ns.Value, name, cascadeDeleteOptions(options), true)
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
func (s *cascadeDeleteStorage) cascadeDelete(ctx context.Context, namespace, name string, options *metav1.DeleteOptions, requested bool) (runtime.Object, bool, error) {
	if err := s.markTerminating(ctx, name, options); err != nil {
		if apierrors.IsNotFound(err) && !requested {
			return nil, false, nil
		}
		return nil, false, err
	}

	children, err := s.childFolders(ctx, namespace, name)
	if err != nil {
		return nil, false, err
	}

	for _, child := range children {
		if _, _, err := s.cascadeDelete(ctx, namespace, child, options, false); err != nil {
			return nil, false, err
		}
	}

	// Remove the dashboards contained directly in this folder before deleting the folder itself.
	if err := s.deleteDashboardsInFolder(ctx, namespace, name, options); err != nil {
		return nil, false, err
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
// observable before its leaves are removed. It honors the delete dry-run so a dry-run folder delete
// does not actually mutate folders.
func (s *cascadeDeleteStorage) markTerminating(ctx context.Context, name string, options *metav1.DeleteOptions) error {
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
		return obj, nil
	})

	updateOpts := &metav1.UpdateOptions{}
	if options != nil {
		updateOpts.DryRun = options.DryRun
	}
	_, _, err := s.Update(ctx, name, objInfo, nil, nil, false, updateOpts)
	return err
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
