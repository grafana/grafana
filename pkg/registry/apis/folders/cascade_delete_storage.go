package folders

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderTerminatingLabel is stamped on a folder once cascade deletion of its subtree has started.
const (
	folderTerminatingLabel      = "grafana.app/folder-terminating"
	folderTerminatingLabelValue = "true"
)

// childFolderPageSize bounds each search page when enumerating direct child folders.
const childFolderPageSize int64 = 1000

var _ grafanarest.Storage = (*cascadeDeleteStorage)(nil)

// cascadeDeleteStorage wraps the folder storage and overrides Delete to recursively remove a
// folder's subtree. Every other REST method is promoted from the embedded storage. It is always
// wired around the underlying storage (both single-tenant and multi-tenant) so the behaviour is
// identical in both deployments.
type cascadeDeleteStorage struct {
	grafanarest.Storage
	searcher resourcepb.ResourceIndexClient
}

// Delete removes a folder and, when cascade delete is enabled, its entire subtree. The subtree is
// walked depth-first: each folder is stamped with a terminating label on the way down, and folders
// are deleted on the way back up once they have no remaining child folders (i.e. leaves first).
func (s *cascadeDeleteStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if !kubernetesFolderCascadeDeleteEnabled(ctx) {
		return s.Storage.Delete(ctx, name, deleteValidation, options)
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	return s.cascadeDelete(ctx, ns.Value, name, deleteValidation, options)
}

// cascadeDelete performs the depth-first deletion of the folder identified by name and all of its
// descendants. deleteValidation is only applied to the originally requested folder; recursive child
// deletes reuse the delete options (e.g. the force opt-in) but skip the request-bound validation.
func (s *cascadeDeleteStorage) cascadeDelete(ctx context.Context, namespace, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if err := s.markTerminating(ctx, name); err != nil {
		// Already gone (e.g. a resumed delete reaching a stale search-index entry, or the folder
		// removed concurrently). Post-order deletion guarantees its subtree was already removed,
		// so there is nothing left to do for this node.
		if apierrors.IsNotFound(err) {
			return nil, false, nil
		}
		return nil, false, err
	}

	children, err := s.childFolders(ctx, namespace, name)
	if err != nil {
		return nil, false, err
	}

	for _, child := range children {
		if _, _, err := s.cascadeDelete(ctx, namespace, child, nil, options); err != nil {
			return nil, false, err
		}
	}

	// No remaining child folders: delete this folder. A NotFound here means it was already
	// deleted, which is success for an idempotent (resumable) cascade.
	obj, async, err := s.Storage.Delete(ctx, name, deleteValidation, options)
	if apierrors.IsNotFound(err) {
		return obj, async, nil
	}
	return obj, async, err
}

// markTerminating stamps the terminating label on the folder so the in-progress subtree deletion is
// observable before its leaves are removed.
func (s *cascadeDeleteStorage) markTerminating(ctx context.Context, name string) error {
	objInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, newObj, _ runtime.Object) (runtime.Object, error) {
		meta, err := utils.MetaAccessor(newObj)
		if err != nil {
			return nil, err
		}
		labels := meta.GetLabels()
		if labels == nil {
			labels = map[string]string{}
		}
		labels[folderTerminatingLabel] = folderTerminatingLabelValue
		meta.SetLabels(labels)
		return newObj, nil
	})

	_, _, err := s.Storage.Update(ctx, name, objInfo, nil, nil, false, &metav1.UpdateOptions{})
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
