package folders

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"
	"k8s.io/client-go/util/retry"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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

// finalizerStorage must intercept both single and collection deletes; otherwise DeleteCollection is
// promoted from the embedded store and bypasses the finalizer/label handling.
var (
	_ rest.GracefulDeleter   = (*finalizerStorage)(nil)
	_ rest.CollectionDeleter = (*finalizerStorage)(nil)
)

func (s *finalizerStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	// A dry-run must not mutate anything: pass straight through with the real validation (which also
	// enforces any precondition) so nothing is stamped.
	if options != nil && dryrun.IsDryRun(options.DryRun) {
		return s.Store.Delete(ctx, name, deleteValidation, options)
	}

	// Run admission and any caller-supplied precondition BEFORE mutating metadata. Both the cascade
	// stamp and the vestigial-finalizer strip below are Updates that advance the resource version, so
	// mutating first would (a) make a conditional delete (Preconditions.ResourceVersion) fail against
	// the bumped RV, and (b) on the cascade path, persist the terminating label even when the delete
	// is about to be rejected -- the poller would then resume a delete the caller saw fail. We enforce
	// admission and the precondition here against the current object, then pass a no-op validator with
	// the precondition cleared to the embedded store (we have already evaluated both), so admission
	// runs exactly once and the RV bump we cause cannot reject an otherwise-valid delete.
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

	// When the caller supplied a resourceVersion precondition, anchor the whole operation on the
	// resource version we just validated: the metadata mutation enforces it (failing on a concurrent
	// change rather than retrying over it), and the final store delete re-checks the resource version
	// the mutation produced. That keeps the precondition atomic end to end -- a concurrent update or
	// delete/recreate between the check and the final delete conflicts instead of slipping through.
	//
	// A UID-only precondition is deliberately not anchored: it guards against delete/recreate while
	// tolerating updates, so an unrelated change between the Get and the final delete must not turn
	// into a spurious conflict. We leave expectedRV empty, so the stamp retries over concurrent
	// changes and the final delete keeps only the UID precondition.
	expectedRV := ""
	if options != nil && options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, false, apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		expectedRV = accessor.GetResourceVersion()
	}

	// Cascade disabled: the finalizer (stamped while the feature was on) is now vestigial and would
	// otherwise block deletion forever, since nothing drives it to completion. Strip it, then delete
	// normally.
	if !s.cascadeEnabled {
		return s.deleteImmediately(ctx, name, options, expectedRV)
	}

	// An empty folder has nothing to cascade, so delete it synchronously rather than leaving it
	// Terminating until the poller's next tick. That keeps a delete followed by an immediate same-UID
	// recreate working -- otherwise the recreate would conflict with the still-terminating object for
	// up to a poll interval. Emptiness is the same eventually-consistent search check delete admission
	// uses; a folder that has just gained contents not yet in the index is the same race the admission
	// empty-check already has, and the cascade poller still covers anything that slips through into the
	// async path below.
	empty, err := s.folderIsEmpty(ctx, genericapirequest.NamespaceValue(ctx), name)
	if err != nil {
		return nil, false, err
	}
	if empty {
		return s.deleteImmediately(ctx, name, options, expectedRV)
	}

	// Stamp the terminating label and finalizer BEFORE the deletion timestamp, so the folder is
	// always discoverable by the cascade poller (which searches on the label). If the process dies
	// after this but before the deletion timestamp is set, the poller still finds the labeled folder,
	// sees it has no deletion timestamp, and resumes the delete -- nothing is silently lost.
	newRV, err := ensureTerminationMetadata(ctx, s.Store, name, expectedRV)
	if err != nil {
		return nil, false, err
	}

	// Set the target's deletion timestamp (the finalizer holds the object until the cascade
	// completes), then mark its subtree asynchronously off the request path -- deleting a large tree
	// must not block (or time out) the request. The cascade poller is the backstop: it completes any
	// marking this best-effort pass does not finish and removes finalizers once children are gone.
	out, deleted, err := finalizeCascadeDelete(ctx, s.Store, name, finalDeleteOptions(options, newRV))
	if err != nil {
		return out, deleted, err
	}
	s.markSubtreeAsync(genericapirequest.NamespaceValue(ctx), name)
	return out, deleted, nil
}

// deleteImmediately strips the cascade finalizer (and terminating label, if any) and deletes the
// folder in place, with no Terminating state. It is used when there is nothing to cascade: the
// feature is off (the finalizer is vestigial) or the folder is empty. Stripping before the delete is
// crash-safe: a crash here leaves an ordinary, non-finalized folder rather than one stuck
// Terminating.
func (s *finalizerStorage) deleteImmediately(ctx context.Context, name string, options *metav1.DeleteOptions, expectedRV string) (runtime.Object, bool, error) {
	newRV, err := removeTerminationMetadata(ctx, s.Store, name, expectedRV)
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, false, err
	}
	return s.Store.Delete(ctx, name, rest.ValidateAllObjectFunc, finalDeleteOptions(options, newRV))
}

// folderIsEmpty reports whether the folder contains nothing the cascade would need to delete -- no
// child folders, dashboards, alert rules, or library elements -- using the same search stats as the
// admission empty-folder check.
func (s *finalizerStorage) folderIsEmpty(ctx context.Context, namespace, name string) (bool, error) {
	res, _, err := folderContents(ctx, s.searcher, namespace, name)
	if err != nil {
		return false, err
	}
	return res == "", nil
}

// finalizeCascadeDelete runs the post-stamp store delete and, on failure, rolls the termination
// marker back. ensureTerminationMetadata has already persisted the terminating label and finalizer,
// which the poller searches on; if the delete fails -- e.g. a conditional delete that loses a race on
// the post-stamp resource version -- returning the error without undoing the marker would leave the
// caller with a conflict while the poller still deletes the folder and its contents. Removing the
// marker makes the outcome match the error. Rollback is best-effort: NotFound means the folder is
// already gone (no marker to worry about), and any other rollback failure leaves the poller as the
// backstop, so it is logged rather than masking the original delete error.
func finalizeCascadeDelete(ctx context.Context, store folderStore, name string, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	out, deleted, err := store.Delete(ctx, name, rest.ValidateAllObjectFunc, options)
	if err == nil || apierrors.IsNotFound(err) {
		// NotFound means the folder is already gone -- there is no marker left to roll back.
		return out, deleted, err
	}
	if _, rbErr := removeTerminationMetadata(ctx, store, name, ""); rbErr != nil && !apierrors.IsNotFound(rbErr) {
		logging.FromContext(ctx).Warn("folder cascade: failed to roll back termination marker after delete error; poller may still cascade",
			"namespace", genericapirequest.NamespaceValue(ctx), "folder", name, "deleteError", err, "rollbackError", rbErr)
	}
	return out, deleted, err
}

// collectionLister is the subset of the embedded store used to enumerate a collection delete.
type collectionLister interface {
	List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error)
}

// DeleteCollection routes a collection delete (e.g. `kubectl delete folders --all` or a
// label-selector delete) through this wrapper's per-object Delete, instead of the embedded store's
// DeleteCollection. Going straight to the embedded store would skip ensureTerminationMetadata /
// removeTerminationMetadata: with cascade on the folders would carry the finalizer but never the
// terminating label the poller searches on (stuck terminating), and with the flag off the vestigial
// finalizers would not be stripped.
func (s *finalizerStorage) DeleteCollection(
	ctx context.Context,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
	listOptions *metainternalversion.ListOptions,
) (runtime.Object, error) {
	return deleteCollectionPerItem(ctx, s.Store, s.Delete, deleteValidation, options, listOptions)
}

// deleteCollectionPerItem lists the matching folders and deletes each through deleteOne (the
// wrapper's Delete), so every item gets the same finalizer/label handling a single delete would. It
// stops at the first non-NotFound error, returning the items deleted so far.
func deleteCollectionPerItem(
	ctx context.Context,
	lister collectionLister,
	deleteOne func(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error),
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
	listOptions *metainternalversion.ListOptions,
) (runtime.Object, error) {
	listObj, err := lister.List(ctx, listOptions)
	if err != nil {
		return nil, err
	}
	items, err := meta.ExtractList(listObj)
	if err != nil {
		return nil, err
	}

	deleted := make([]runtime.Object, 0, len(items))
	for _, item := range items {
		accessor, err := meta.Accessor(item)
		if err != nil {
			return nil, err
		}
		out, _, err := deleteOne(ctx, accessor.GetName(), deleteValidation, options)
		if err != nil && !apierrors.IsNotFound(err) {
			return nil, err
		}
		if out != nil {
			deleted = append(deleted, out)
		} else {
			deleted = append(deleted, item)
		}
	}

	if err := meta.SetList(listObj, deleted); err != nil {
		return nil, err
	}
	return listObj, nil
}

// checkDeletePreconditions enforces DeleteOptions.Preconditions (UID / ResourceVersion) against the
// current object, mirroring the embedded store's own check. We run it before stamping termination
// metadata, since that stamp advances the resource version and would otherwise make a valid
// conditional delete fail -- and would persist the terminating label for a delete that should be
// rejected.
func checkDeletePreconditions(obj runtime.Object, options *metav1.DeleteOptions) error {
	if options == nil || options.Preconditions == nil {
		return nil
	}
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
	}
	gr := folders.FolderResourceInfo.GroupVersionResource().GroupResource()
	if uid := options.Preconditions.UID; uid != nil && *uid != accessor.GetUID() {
		return apierrors.NewConflict(gr, accessor.GetName(),
			fmt.Errorf("the UID in the precondition (%v) does not match the UID in record (%v)", *uid, accessor.GetUID()))
	}
	if rv := options.Preconditions.ResourceVersion; rv != nil && *rv != accessor.GetResourceVersion() {
		return apierrors.NewConflict(gr, accessor.GetName(),
			fmt.Errorf("the ResourceVersion in the precondition (%v) does not match the ResourceVersion in record (%v)", *rv, accessor.GetResourceVersion()))
	}
	return nil
}

// finalDeleteOptions rebases a caller's resourceVersion precondition onto newRV -- the resource
// version produced by the metadata mutation -- so the embedded store's delete is a compare-and-swap
// against the object we just stamped, rather than the caller's now-stale resource version. A UID
// precondition is kept as-is, and a UID-only precondition is left without a resourceVersion: pinning
// it to newRV would make an unrelated concurrent update fail the delete, defeating the point of a
// UID-only precondition (guard delete/recreate, tolerate updates). When the caller supplied no
// precondition, options is returned unchanged.
func finalDeleteOptions(options *metav1.DeleteOptions, newRV string) *metav1.DeleteOptions {
	if options == nil || options.Preconditions == nil {
		return options
	}
	cp := *options
	pc := *options.Preconditions
	if pc.ResourceVersion != nil {
		pc.ResourceVersion = &newRV
	}
	cp.Preconditions = &pc
	return &cp
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
		if _, err := ensureTerminationMetadata(ctx, store, child, ""); err != nil {
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

// mutateTerminationMetadata applies the cascade metadata change `mutate` under optimistic
// concurrency, returning the object's resource version afterwards (unchanged if `mutate` reported
// nothing to do).
//
// When expectedRV is empty it retries over conflicts -- used by best-effort marking, where racing a
// concurrent update and re-applying is fine. When expectedRV is set (a caller's delete precondition),
// it instead requires that resource version and does NOT retry: a concurrent change makes the stamp
// fail with a conflict that propagates to the caller, rather than the stamp silently retrying over the
// newer object and letting a stale conditional delete proceed.
func mutateTerminationMetadata(ctx context.Context, store folderGetUpdater, name, expectedRV string, mutate func(metav1.Object) bool) (string, error) {
	apply := func() (string, error) {
		obj, err := store.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return "", err
		}
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return "", apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		if expectedRV != "" && accessor.GetResourceVersion() != expectedRV {
			return "", apierrors.NewConflict(folders.FolderResourceInfo.GroupVersionResource().GroupResource(), name,
				fmt.Errorf("the object has been modified; the delete precondition (resourceVersion %q) no longer holds", expectedRV))
		}

		updated := obj.DeepCopyObject()
		updatedAccessor, err := meta.Accessor(updated)
		if err != nil {
			return "", apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		if !mutate(updatedAccessor) {
			return accessor.GetResourceVersion(), nil
		}

		// updated carries the (expected) resource version, so the store's update is a compare-and-swap:
		// a concurrent change between this Get and Update conflicts rather than being overwritten.
		out, _, err := store.Update(ctx, name, rest.DefaultUpdatedObjectInfo(updated),
			rest.ValidateAllObjectFunc, rest.ValidateAllObjectUpdateFunc, false, &metav1.UpdateOptions{})
		if err != nil {
			return "", err
		}
		outAccessor, err := meta.Accessor(out)
		if err != nil {
			return "", apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		return outAccessor.GetResourceVersion(), nil
	}

	if expectedRV != "" {
		return apply() // precondition mode: fail on conflict, do not retry over a concurrent change
	}
	var rv string
	err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		var e error
		rv, e = apply()
		return e
	})
	return rv, err
}

// ensureTerminationMetadata stamps the cascade finalizer and terminating label before delete
// proceeds. The finalizer blocks physical removal until children are gone; the label is what
// the cascade watcher selects on, so it must be present before the delete sets the deletion
// timestamp and the folder enters the watcher's filtered set. It returns the object's resource
// version after stamping (see mutateTerminationMetadata for the expectedRV semantics).
//
// It backfills a missing label even when the folder already has a deletion timestamp: the normal
// flow stamps the label before the timestamp, but if a folder ends up terminating without the label
// (e.g. manual edit or older data) the poller would never find it. applyTerminationMetadata no-ops
// when nothing is missing, so the already-fully-stamped case stays a cheap read with no write.
func ensureTerminationMetadata(ctx context.Context, store folderGetUpdater, name, expectedRV string) (string, error) {
	return mutateTerminationMetadata(ctx, store, name, expectedRV, applyTerminationMetadata)
}

// removeTerminationMetadata strips the cascade finalizer and terminating label from a folder if
// present. It is used when the feature is disabled, so a folder that still carries the (now
// vestigial) metadata can be deleted instead of hanging in Terminating, and so no stray terminating
// label is left to mislead the poller if the feature is re-enabled. It is a no-op if neither is set.
func removeTerminationMetadata(ctx context.Context, store folderGetUpdater, name, expectedRV string) (string, error) {
	return mutateTerminationMetadata(ctx, store, name, expectedRV, removeCascadeMetadataFields)
}

// removeCascadeMetadataFields strips the cascade finalizer and terminating label from the object,
// reporting whether it changed anything.
func removeCascadeMetadataFields(accessor metav1.Object) bool {
	finalizers := accessor.GetFinalizers()
	labels := accessor.GetLabels()
	hasFinalizer := hasCascadeFinalizer(finalizers)
	hasLabel := labels[TerminatingLabel] == TerminatingLabelValue
	if !hasFinalizer && !hasLabel {
		return false
	}

	if hasFinalizer {
		remaining := make([]string, 0, len(finalizers))
		for _, f := range finalizers {
			if f != CascadeDeleteFinalizer {
				remaining = append(remaining, f)
			}
		}
		accessor.SetFinalizers(remaining)
	}
	if hasLabel {
		newLabels := make(map[string]string, len(labels))
		for k, v := range labels {
			if k != TerminatingLabel {
				newLabels[k] = v
			}
		}
		accessor.SetLabels(newLabels)
	}
	return true
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
