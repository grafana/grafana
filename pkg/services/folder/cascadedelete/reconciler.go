// Package cascadedelete implements the finalizer-driven cascade delete of a folder: each terminating
// folder deletes only its own direct children and releases its finalizer once none remain. A deleted
// subfolder carries the same finalizer and runs its own cascade, so a folder disappearing proves its
// whole subtree is gone without this package ever recursing.
package cascadedelete

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"k8s.io/apimachinery/pkg/api/equality"

	"github.com/grafana/grafana-app-sdk/logging"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

const (
	// DefaultBatchSize bounds the deletes issued by one reconcile, so a large folder is torn down
	// across many short reconciles instead of one long one.
	DefaultBatchSize = 100
	// maxStatusErrors bounds status.cascadeDelete.errors so a folder full of failing children
	// cannot grow the object without limit.
	maxStatusErrors = 10
)

// ChildKind is the kind of a folder's direct child.
type ChildKind string

const (
	ChildFolder    ChildKind = "folders"
	ChildDashboard ChildKind = "dashboards"
)

// Child is a direct child of a folder.
type Child struct {
	Kind ChildKind
	Name string
}

// DeleteOutcome reports what deleting a child did.
type DeleteOutcome int

const (
	// DeleteOutcomeDeleted means the child was deleted and is gone.
	DeleteOutcomeDeleted DeleteOutcome = iota
	// DeleteOutcomePending means the delete was accepted but the child is held by finalizers; a
	// subfolder with the cascade finalizer stays until its own cascade releases it.
	DeleteOutcomePending
	// DeleteOutcomeTerminating means the child was already being deleted; nothing was issued.
	DeleteOutcomeTerminating
	// DeleteOutcomeGone means the child no longer exists or is no longer in this folder (e.g. a
	// stale search hit).
	DeleteOutcomeGone
)

// childKinds is the order children are deleted in: subfolders first, so their own cascades start
// as early as possible.
var childKinds = []ChildKind{ChildFolder, ChildDashboard}

// ChildLister pages through a folder's direct children of one kind.
type ChildLister interface {
	// ListChildren returns up to limit direct children of kind in folderUID, starting at offset, and
	// the total number of them.
	ListChildren(ctx context.Context, namespace, folderUID string, kind ChildKind, offset, limit int64) ([]Child, int64, error)
}

// ChildDeleter deletes one child of parentUID. Children are deleted with force, so a non-empty
// subfolder is let through to run its own cascade.
type ChildDeleter interface {
	Delete(ctx context.Context, namespace, parentUID string, child Child) (DeleteOutcome, error)
}

// FolderGetter reads a folder's current state. It returns a NotFound error once the folder is gone.
type FolderGetter interface {
	Get(ctx context.Context, namespace, name string) (*foldersv1.Folder, error)
}

// FolderWriter persists cascade progress and releases the folder.
type FolderWriter interface {
	// UpdateCascadeStatus writes status.cascadeDelete through the status subresource.
	UpdateCascadeStatus(ctx context.Context, namespace, name string, status foldersv1.FolderCascadeDeleteStatus) error
	// RemoveFinalizer removes the cascade finalizer, given the folder's current finalizers, leaving
	// any others in place.
	RemoveFinalizer(ctx context.Context, namespace, name string, finalizers []string) error
}

// ErrChildrenStillListed reports a pass that found only children that are already gone. That
// usually means the search index has not caught up with deletes or moves yet, so the folder must be
// retried with backoff: requeueing it at once would query search in a tight loop until it does.
var ErrChildrenStillListed = errors.New("children already deleted are still listed")

// Result tells the caller what to do with the folder. It is only meaningful when the pass returned no
// error; a failed pass should be retried with backoff whatever it reports.
type Result struct {
	// Requeue means the pass issued deletes, so the folder has more work right away.
	Requeue bool
	// Released means the pass removed the cascade finalizer, so the folder's parent may now be able
	// to finish and should be woken.
	Released bool
}

// Reconciler advances the cascade delete of one folder per call.
type Reconciler struct {
	Children ChildLister
	Deleter  ChildDeleter
	Folders  FolderWriter
	// BatchSize caps the deletes issued per reconcile; DefaultBatchSize when <= 0.
	BatchSize int
}

// Reconcile deletes up to a batch of f's direct children and records progress in
// status.cascadeDelete. Once f has no direct children left it marks the cascade completed and
// removes the cascade finalizer. It does nothing unless f is terminating and still carries the
// finalizer. A returned error means the pass partly failed and should be retried with backoff.
//
// A pass that issues nothing because every child is already being deleted returns an empty Result:
// those subfolders run their own cascade, and releasing one wakes f, so f must not requeue itself.
func (r *Reconciler) Reconcile(ctx context.Context, f *foldersv1.Folder) (Result, error) {
	if f.DeletionTimestamp == nil || !slices.Contains(f.Finalizers, foldersv1.CascadeDeleteFinalizer) {
		return Result{}, nil
	}
	logger := logging.FromContext(ctx).With("namespace", f.Namespace, "folder", f.Name)

	prior := f.Status.CascadeDelete
	status := copyStatus(prior)
	now := time.Now().UnixMilli()
	if status.Started == nil {
		status.Started = &now
	}

	// Only the first page of each kind is read up front; progress comes from the hit totals, so a
	// large folder costs a batch-sized read per pass rather than a full listing.
	batch := int64(r.batchSize())
	cursors := make([]childCursor, 0, len(childKinds))
	var total int64
	for _, kind := range childKinds {
		page, n, err := r.Children.ListChildren(ctx, f.Namespace, f.Name, kind, 0, batch)
		if err != nil {
			err = fmt.Errorf("list %s: %w", kind, err)
			status.State = foldersv1.FolderCascadeDeleteStatusStateFailed
			status.Errors = []string{err.Error()}
			return Result{}, errors.Join(err, r.writeStatus(ctx, f, prior, status))
		}
		n = max(n, int64(len(page)))
		cursors = append(cursors, childCursor{kind: kind, page: page, offset: int64(len(page)), total: n})
		total += n
	}
	if status.Total == nil {
		status.Total = &total
	}

	if total == 0 {
		remaining := int64(0)
		status.State = foldersv1.FolderCascadeDeleteStatusStateCompleted
		status.Remaining = &remaining
		status.Errors = nil
		// Keep the first completion time when only the finalizer removal is being retried.
		if prior == nil || prior.State != foldersv1.FolderCascadeDeleteStatusStateCompleted || prior.Finished == nil {
			status.Finished = &now
		}
		if err := r.writeStatus(ctx, f, prior, status); err != nil {
			return Result{}, err
		}
		if err := r.Folders.RemoveFinalizer(ctx, f.Namespace, f.Name, f.Finalizers); err != nil {
			return Result{}, fmt.Errorf("remove finalizer: %w", err)
		}
		logger.Info("Folder cascade delete completed")
		return Result{Released: true}, nil
	}

	remaining := total
	issued, gone := int64(0), 0
	var failures []error
	for i := range cursors {
		cur := &cursors[i]
		for issued < batch {
			c, ok, err := r.next(ctx, f, cur, batch)
			if err != nil {
				failures = append(failures, fmt.Errorf("list %s: %w", cur.kind, err))
				break
			}
			if !ok {
				break
			}
			outcome, err := r.Deleter.Delete(ctx, f.Namespace, f.Name, c)
			if err != nil {
				issued++
				failures = append(failures, fmt.Errorf("%s/%s: %w", c.Kind, c.Name, err))
				continue
			}
			switch outcome {
			case DeleteOutcomeDeleted:
				issued++
				remaining--
			case DeleteOutcomePending:
				// Still a child until its finalizers clear.
				issued++
			case DeleteOutcomeGone:
				gone++
				remaining--
			case DeleteOutcomeTerminating:
				// Already being deleted: costs no batch slot, so a page of slow subfolders cannot starve
				// the children behind it.
			}
		}
	}

	status.Remaining = &remaining
	status.State = foldersv1.FolderCascadeDeleteStatusStateInProgress
	status.Errors = nil
	if len(failures) > 0 {
		status.State = foldersv1.FolderCascadeDeleteStatusStateFailed
		// Sorted before capping: search returns children in no fixed order, and a status that changed
		// only by ordering would still be written, and its event would requeue the folder past its backoff.
		msgs := make([]string, 0, len(failures))
		for _, e := range failures {
			msgs = append(msgs, e.Error())
		}
		slices.Sort(msgs)
		status.Errors = msgs[:min(len(msgs), maxStatusErrors)]
		logger.Warn("Folder cascade delete pass had failures", "failed", len(failures), "remaining", remaining)
	}
	writeErr := r.writeStatus(ctx, f, prior, status)
	switch {
	case issued > 0:
		return Result{Requeue: true}, errors.Join(errors.Join(failures...), writeErr)
	case len(failures) > 0:
		// A later page failed to list before anything was issued.
		return Result{}, errors.Join(errors.Join(failures...), writeErr)
	case writeErr != nil:
		return Result{}, writeErr
	case gone > 0:
		return Result{}, ErrChildrenStillListed
	default:
		return Result{}, nil
	}
}

// childCursor walks one kind of child across search pages within a pass.
type childCursor struct {
	kind   ChildKind
	page   []Child
	offset int64
	total  int64
}

// next returns the cursor's next child, fetching another page only when the batch still has room,
// which happens when children are skipped. Deletes earlier in the pass can shift offsets so a later
// page skips some children; they are picked up by the next pass, and the folder is only released
// once a pass sees no children at all.
func (r *Reconciler) next(ctx context.Context, f *foldersv1.Folder, cur *childCursor, batch int64) (Child, bool, error) {
	if len(cur.page) == 0 {
		if cur.offset >= cur.total {
			return Child{}, false, nil
		}
		page, _, err := r.Children.ListChildren(ctx, f.Namespace, f.Name, cur.kind, cur.offset, batch)
		if err != nil {
			return Child{}, false, err
		}
		if len(page) == 0 {
			return Child{}, false, nil
		}
		cur.page = page
		cur.offset += int64(len(page))
	}
	c := cur.page[0]
	cur.page = cur.page[1:]
	return c, true, nil
}

// writeStatus skips no-op writes: every status write is a watch event, and a folder that is only
// waiting on terminating subfolders would otherwise wake itself up on each pass.
func (r *Reconciler) writeStatus(ctx context.Context, f *foldersv1.Folder, prior *foldersv1.FolderCascadeDeleteStatus, status foldersv1.FolderCascadeDeleteStatus) error {
	if prior != nil && equality.Semantic.DeepEqual(*prior, status) {
		return nil
	}
	if err := r.Folders.UpdateCascadeStatus(ctx, f.Namespace, f.Name, status); err != nil {
		return fmt.Errorf("update cascade status: %w", err)
	}
	return nil
}

func (r *Reconciler) batchSize() int {
	if r.BatchSize <= 0 {
		return DefaultBatchSize
	}
	return r.BatchSize
}

// copyStatus copies s so edits do not leak into the caller's folder. The pointer fields are only
// ever replaced, never written through, so sharing their targets is safe.
func copyStatus(s *foldersv1.FolderCascadeDeleteStatus) foldersv1.FolderCascadeDeleteStatus {
	if s == nil {
		return foldersv1.FolderCascadeDeleteStatus{}
	}
	out := *s
	out.Errors = slices.Clone(s.Errors)
	return out
}
