package folders

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// maxCascadeMarkDepth bounds the recursive subtree mark so a corrupt parent/child cycle (which
// folder validation already prevents) can never spin forever.
const maxCascadeMarkDepth = 100

// finalizerStorage wraps a folder registry store and starts cascade deletion at delete time: it
// stamps the cascade-delete finalizer and terminating label on the deleted folder, then kicks off
// an asynchronous best-effort DFS that marks its subtree terminating. The cascade poller is the
// source of truth for completion: it marks any still-unmarked children of terminating folders and
// removes the finalizer once a folder has no children left. Legacy folders created before admission
// defaulting may not have the finalizer until the first delete, and the terminating label is only
// ever stamped here, on delete.
type finalizerStorage struct {
	*registry.Store
	searcher resourcepb.ResourceIndexClient
}

func newFinalizerStorage(store *registry.Store, searcher resourcepb.ResourceIndexClient) *finalizerStorage {
	return &finalizerStorage{Store: store, searcher: searcher}
}

func (s *finalizerStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	if options == nil || !dryrun.IsDryRun(options.DryRun) {
		// Mark this folder terminating synchronously, then mark its subtree asynchronously off
		// the request path -- deleting a large tree must not block (or time out) the request. The
		// cascade poller is the backstop: it completes any marking this best-effort pass does not
		// finish and removes finalizers once a folder has no children left.
		if err := ensureTerminationMetadata(ctx, s.Store, name); err != nil {
			return nil, false, err
		}
		s.markSubtreeAsync(genericapirequest.NamespaceValue(ctx), name)
	}
	return s.Store.Delete(ctx, name, deleteValidation, options)
}

// markSubtreeAsync launches a detached, best-effort DFS that marks every descendant of name
// terminating. It runs under the service identity on a background context, so a crash or shutdown
// just leaves a partial mark that the cascade poller finishes.
func (s *finalizerStorage) markSubtreeAsync(namespace, name string) {
	go func() {
		ctx := context.Background()
		if info, err := claims.ParseNamespace(namespace); err == nil {
			ctx = identity.WithServiceIdentityContext(ctx, info.OrgID)
		}
		ctx = genericapirequest.WithNamespace(ctx, namespace)
		if err := markDescendants(ctx, s.Store, s.searcher, namespace, name, 0); err != nil {
			logging.FromContext(ctx).Warn("folder cascade: async subtree marking failed; poller will complete it",
				"namespace", namespace, "folder", name, "error", err)
		}
	}()
}

// folderStore is the subset of the folder registry store used to mark a subtree terminating.
type folderStore interface {
	folderGetUpdater
	rest.GracefulDeleter
}

// folderGetUpdater is the subset of the folder store used to backfill termination metadata.
type folderGetUpdater interface {
	rest.Getter
	rest.Updater
}

// markDescendants recursively marks every folder under parent terminating: it stamps the cascade
// finalizer and terminating label and sets a deletion timestamp (via a graceful delete, which the
// finalizer turns into "marked, not removed"). It does not mark parent itself -- the caller does.
func markDescendants(ctx context.Context, store folderStore, searcher resourcepb.ResourceIndexClient, namespace, parent string, depth int) error {
	if depth >= maxCascadeMarkDepth {
		return fmt.Errorf("folder cascade exceeded max depth (%d) at %q", maxCascadeMarkDepth, parent)
	}

	children, err := directChildFolders(ctx, searcher, namespace, parent)
	if err != nil {
		return err
	}

	zero := int64(0)
	for _, child := range children {
		if err := markDescendants(ctx, store, searcher, namespace, child, depth+1); err != nil {
			return err
		}
		if err := ensureTerminationMetadata(ctx, store, child); err != nil {
			return err
		}
		if _, _, err := store.Delete(ctx, child, rest.ValidateAllObjectFunc, &metav1.DeleteOptions{GracePeriodSeconds: &zero}); err != nil && !apierrors.IsNotFound(err) {
			return err
		}
	}
	return nil
}

// directChildFolders returns the UIDs of folders whose parent is parentUID, paging through search.
func directChildFolders(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace, parentUID string) ([]string, error) {
	const pageSize int64 = 1000
	var all []string
	for offset := int64(0); ; {
		children, hasMore, err := getChildrenBatch(ctx, searcher, namespace, []string{parentUID}, pageSize, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, children...)
		if !hasMore {
			return all, nil
		}
		offset += pageSize
	}
}

// ensureTerminationMetadata stamps the cascade finalizer and terminating label before delete
// proceeds. The finalizer blocks physical removal until children are gone; the label is what
// the cascade watcher selects on, so it must be present before the delete sets the deletion
// timestamp and the folder enters the watcher's filtered set.
func ensureTerminationMetadata(ctx context.Context, store folderGetUpdater, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := store.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return err
		}

		accessor, err := meta.Accessor(obj)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}

		// Already terminating: the delete that started termination already stamped the
		// finalizer and terminating label, so there is nothing to add.
		if accessor.GetDeletionTimestamp() != nil && !accessor.GetDeletionTimestamp().IsZero() {
			return nil
		}

		updated := obj.DeepCopyObject()
		updatedAccessor, err := meta.Accessor(updated)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		if !applyTerminationMetadata(updatedAccessor) {
			return nil
		}

		_, _, err = store.Update(
			ctx,
			name,
			rest.DefaultUpdatedObjectInfo(updated),
			rest.ValidateAllObjectFunc,
			rest.ValidateAllObjectUpdateFunc,
			false,
			&metav1.UpdateOptions{},
		)
		return err
	})
}

// applyTerminationMetadata adds the cascade finalizer and terminating label to the object if
// either is missing. The finalizer is usually already present (admission stamps it on create),
// so in the common path this is what backfills the label. It reports whether it changed
// anything.
func applyTerminationMetadata(accessor metav1.Object) bool {
	changed := false

	if !hasCascadeFinalizer(accessor.GetFinalizers()) {
		accessor.SetFinalizers(append(accessor.GetFinalizers(), CascadeDeleteFinalizer))
		changed = true
	}

	if accessor.GetLabels()[TerminatingLabel] != TerminatingLabelValue {
		labels := accessor.GetLabels()
		if labels == nil {
			labels = map[string]string{}
		}
		labels[TerminatingLabel] = TerminatingLabelValue
		accessor.SetLabels(labels)
		changed = true
	}

	return changed
}

func hasCascadeFinalizer(finalizers []string) bool {
	for _, f := range finalizers {
		if f == CascadeDeleteFinalizer {
			return true
		}
	}
	return false
}
