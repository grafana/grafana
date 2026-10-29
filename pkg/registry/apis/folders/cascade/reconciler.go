// Package cascade implements the finalizer-driven cascade delete of a folder: each terminating
// folder deletes only its own direct children and releases its finalizer once none remain. A deleted
// subfolder carries the same finalizer and runs its own cascade, so a folder disappearing proves its
// whole subtree is gone without this package ever recursing.
package cascade

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

// ChildLister lists a folder's direct children: subfolders and dashboards whose parent is folderUID.
type ChildLister interface {
	DirectChildren(ctx context.Context, namespace, folderUID string) ([]Child, error)
}

// ChildDeleter deletes one child of parentUID. Subfolders are deleted with force so the emptiness
// check lets through the subfolders and dashboards their own cascade will remove.
type ChildDeleter interface {
	Delete(ctx context.Context, namespace, parentUID string, child Child) (DeleteOutcome, error)
}

// FolderWriter persists cascade progress and releases the folder.
type FolderWriter interface {
	// UpdateCascadeStatus writes status.cascadeDelete through the status subresource.
	UpdateCascadeStatus(ctx context.Context, namespace, name string, status foldersv1.FolderCascadeDeleteStatus) error
	// RemoveFinalizer removes the cascade finalizer, given the folder's current finalizers, leaving
	// any others in place.
	RemoveFinalizer(ctx context.Context, namespace, name string, finalizers []string) error
}

// Result tells the caller whether the folder needs another reconcile.
type Result struct {
	Requeue bool
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

	children, err := r.Children.DirectChildren(ctx, f.Namespace, f.Name)
	if err != nil {
		err = fmt.Errorf("list children: %w", err)
		status.State = foldersv1.FolderCascadeDeleteStatusStateFailed
		status.Errors = []string{err.Error()}
		return Result{Requeue: true}, errors.Join(err, r.writeStatus(ctx, f, prior, status))
	}
	if status.Total == nil {
		total := int64(len(children))
		status.Total = &total
	}

	if len(children) == 0 {
		remaining := int64(0)
		status.State = foldersv1.FolderCascadeDeleteStatusStateCompleted
		status.Remaining = &remaining
		status.Errors = nil
		// Keep the first completion time when only the finalizer removal is being retried.
		if prior == nil || prior.State != foldersv1.FolderCascadeDeleteStatusStateCompleted || prior.Finished == nil {
			status.Finished = &now
		}
		if err := r.writeStatus(ctx, f, prior, status); err != nil {
			return Result{Requeue: true}, err
		}
		if err := r.Folders.RemoveFinalizer(ctx, f.Namespace, f.Name, f.Finalizers); err != nil {
			return Result{Requeue: true}, fmt.Errorf("remove finalizer: %w", err)
		}
		logger.Info("Folder cascade delete completed")
		return Result{}, nil
	}

	remaining := int64(len(children))
	issued := 0
	var failures []error
	for _, c := range children {
		if issued >= r.batchSize() {
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
			remaining--
		case DeleteOutcomeTerminating:
			// Already being deleted: costs no batch slot, so a page of slow subfolders cannot starve
			// the children behind it.
		}
	}

	status.Remaining = &remaining
	status.State = foldersv1.FolderCascadeDeleteStatusStateInProgress
	status.Errors = nil
	if len(failures) > 0 {
		status.State = foldersv1.FolderCascadeDeleteStatusStateFailed
		for _, e := range failures[:min(len(failures), maxStatusErrors)] {
			status.Errors = append(status.Errors, e.Error())
		}
		logger.Warn("Folder cascade delete pass had failures", "failed", len(failures), "remaining", remaining)
	}
	return Result{Requeue: true}, errors.Join(errors.Join(failures...), r.writeStatus(ctx, f, prior, status))
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
