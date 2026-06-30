package folders

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
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
// folder's subtree. Every other REST method is promoted from the embedded storage. It is always
// wired around the underlying storage (both single-tenant and multi-tenant) so the behaviour is
// identical in both deployments.
type cascadeDeleteStorage struct {
	grafanarest.Storage
	searcher resourcepb.ResourceIndexClient
	// dashboardClient resolves the dashboard apiserver client used to delete dashboards contained in
	// a folder. May return nil when no client is configured, in which case dashboard cleanup is
	// skipped.
	dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)
}

// Delete removes a folder and, when cascade delete is enabled, its entire subtree. The subtree is
// walked depth-first: each folder is stamped with a terminating label on the way down, and folders
// are deleted on the way back up once they have no remaining child folders (i.e. leaves first).
func (s *cascadeDeleteStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// Only cascade behind the same force opt-in that validateOnDelete uses to bypass its empty
	// check. Otherwise delegate so deleteValidation runs against the still-populated folder and
	// rejects a non-empty delete, instead of us emptying it first.
	if !kubernetesFolderCascadeDeleteEnabled(ctx) || !forceDeleteFromDeleteOptions(options) {
		return s.Storage.Delete(ctx, name, deleteValidation, options)
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	return s.cascadeDelete(ctx, ns.Value, name, deleteValidation, options, true)
}

// cascadeDelete performs the depth-first deletion of the folder identified by name and all of its
// descendants. deleteValidation is only applied to the originally requested folder; recursive child
// deletes reuse the delete options (e.g. the force opt-in) but skip the request-bound validation.
// requested marks the originally requested folder, which preserves NotFound; recursive children
// suppress it (a stale search-index entry or already-removed subtree node is not an error).
func (s *cascadeDeleteStorage) cascadeDelete(ctx context.Context, namespace, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, requested bool) (runtime.Object, bool, error) {
	if err := s.markTerminating(ctx, name); err != nil {
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
		if _, _, err := s.cascadeDelete(ctx, namespace, child, nil, options, false); err != nil {
			return nil, false, err
		}
	}

	// Remove the dashboards contained directly in this folder before deleting the folder itself.
	if err := s.deleteDashboardsInFolder(ctx, namespace, name, options); err != nil {
		return nil, false, err
	}

	// No remaining child folders: delete this folder. For children a NotFound means already-deleted
	// (idempotent/resumable); the requested folder preserves the API's missing-resource error.
	obj, async, err := s.Storage.Delete(ctx, name, deleteValidation, options)
	if apierrors.IsNotFound(err) && !requested {
		return obj, async, nil
	}
	return obj, async, err
}

// deleteDashboardsInFolder removes every dashboard whose grafana.app/folder annotation points at
// folderUID. Deletes go through the dashboard apiserver (so its admission and delete hooks run); a
// NotFound for an individual dashboard is treated as already-done so the sweep is idempotent and
// resumable.
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

	// Carry dry-run and the force opt-in to dashboard deletes; folder-specific preconditions don't
	// apply to dashboards so they are not propagated.
	dashOpts := metav1.DeleteOptions{}
	if options != nil {
		dashOpts.DryRun = options.DryRun
		dashOpts.GracePeriodSeconds = options.GracePeriodSeconds
	}

	// Enumerate fully before deleting: offset paging is only valid against a stable collection, and
	// deleting mid-pagination would shift later pages and skip dashboards.
	names, err := s.dashboardsInFolder(ctx, namespace, folderUID)
	if err != nil {
		return err
	}

	for _, name := range names {
		if err := client.Delete(ctx, name, dashOpts); err != nil && !apierrors.IsNotFound(err) {
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
		if offset+int64(len(resp.Results.Rows)) >= resp.TotalHits {
			return names, nil
		}
		offset += childFolderPageSize
	}
}

// markTerminating stamps the terminating label on the folder so the in-progress subtree deletion is
// observable before its leaves are removed.
func (s *cascadeDeleteStorage) markTerminating(ctx context.Context, name string) error {
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

	_, _, err := s.Update(ctx, name, objInfo, nil, nil, false, &metav1.UpdateOptions{})
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
		offset += childFolderPageSize
	}

	return all, nil
}
