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

// finalizerStorage wraps a folder registry store to manage the cascade-delete finalizer. It is
// installed regardless of the feature flag, because folders created while the flag was on carry the
// finalizer durably and something must always be able to take it off -- otherwise toggling the flag
// off would strand those folders, unable to ever delete.
//
// When cascade is enabled, Delete starts cascade deletion: it stamps the cascade-delete finalizer
// and terminating label on the deleted folder, then kicks off an asynchronous best-effort DFS that
// marks its subtree terminating. The cascade poller is the source of truth for completion: it marks
// any still-unmarked children of terminating folders and removes the finalizer once a folder has no
// children left.
//
// When cascade is disabled, the finalizer is vestigial; Delete strips it (if present) before
// deleting so the delete actually completes instead of hanging forever in Terminating.
type finalizerStorage struct {
	*registry.Store
	searcher       resourcepb.ResourceIndexClient
	cascadeEnabled bool
}

func newFinalizerStorage(store *registry.Store, searcher resourcepb.ResourceIndexClient, cascadeEnabled bool) *finalizerStorage {
	return &finalizerStorage{Store: store, searcher: searcher, cascadeEnabled: cascadeEnabled}
}

func (s *finalizerStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	// A dry-run must not mutate anything: pass straight through with the real validation.
	if options != nil && dryrun.IsDryRun(options.DryRun) {
		return s.Store.Delete(ctx, name, deleteValidation, options)
	}

	// Cascade disabled: the finalizer (stamped while the feature was on) is now vestigial and would
	// otherwise block deletion forever, since nothing drives it to completion. Strip it, then delete
	// normally. Stripping before the delete is crash-safe: a crash here leaves an ordinary,
	// non-finalized folder rather than one stuck Terminating.
	if !s.cascadeEnabled {
		if err := removeTerminationMetadata(ctx, s.Store, name); err != nil && !apierrors.IsNotFound(err) {
			return nil, false, err
		}
		return s.Store.Delete(ctx, name, deleteValidation, options)
	}

	// Validate the delete BEFORE marking anything terminating. Marking stamps the terminating label
	// and kicks off the asynchronous subtree marking, so a delete that admission rejects (e.g. a
	// non-force delete of a non-empty folder) must not leave the tree half-cascaded. We run
	// deleteValidation against the current object here and pass a no-op validator to the embedded
	// store below so admission is evaluated exactly once.
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, obj); err != nil {
			return nil, false, err
		}
	}

	// Stamp the terminating label and finalizer BEFORE the deletion timestamp, so the folder is
	// always discoverable by the cascade poller (which searches on the label). If the process dies
	// after this but before the deletion timestamp is set, the poller still finds the labeled folder,
	// sees it has no deletion timestamp, and resumes the delete -- nothing is silently lost.
	if err := ensureTerminationMetadata(ctx, s.Store, name); err != nil {
		return nil, false, err
	}

	// Set the target's deletion timestamp (the finalizer holds the object until the cascade
	// completes), then mark its subtree asynchronously off the request path -- deleting a large tree
	// must not block (or time out) the request. The cascade poller is the backstop: it completes any
	// marking this best-effort pass does not finish and removes finalizers once children are gone.
	out, deleted, err := s.Store.Delete(ctx, name, rest.ValidateAllObjectFunc, options)
	if err != nil {
		return out, deleted, err
	}
	s.markSubtreeAsync(genericapirequest.NamespaceValue(ctx), name)
	return out, deleted, nil
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
//
// It backfills a missing label even when the folder already has a deletion timestamp: the normal
// flow stamps the label before the timestamp, but if a folder ends up terminating without the label
// (e.g. manual edit or older data) the poller would never find it. applyTerminationMetadata no-ops
// when nothing is missing, so the already-fully-stamped case stays a cheap read with no write.
func ensureTerminationMetadata(ctx context.Context, store folderGetUpdater, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := store.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return err
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

// removeTerminationMetadata strips the cascade finalizer and terminating label from a folder if
// present. It is used when the feature is disabled, so a folder that still carries the (now
// vestigial) metadata can be deleted instead of hanging in Terminating, and so no stray terminating
// label is left to mislead the poller if the feature is re-enabled. It is a no-op if neither is set.
func removeTerminationMetadata(ctx context.Context, store folderGetUpdater, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := store.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return err
		}

		accessor, err := meta.Accessor(obj)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}

		finalizers := accessor.GetFinalizers()
		labels := accessor.GetLabels()
		hasFinalizer := hasCascadeFinalizer(finalizers)
		hasLabel := labels[TerminatingLabel] == TerminatingLabelValue
		if !hasFinalizer && !hasLabel {
			return nil
		}

		updated := obj.DeepCopyObject()
		updatedAccessor, err := meta.Accessor(updated)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}

		if hasFinalizer {
			remaining := make([]string, 0, len(finalizers))
			for _, f := range finalizers {
				if f != CascadeDeleteFinalizer {
					remaining = append(remaining, f)
				}
			}
			updatedAccessor.SetFinalizers(remaining)
		}
		if hasLabel {
			newLabels := make(map[string]string, len(labels))
			for k, v := range labels {
				if k != TerminatingLabel {
					newLabels[k] = v
				}
			}
			updatedAccessor.SetLabels(newLabels)
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
