package folderreconcile

import (
	"context"
	"fmt"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

// ChildFolder is a direct child folder and whether its own deletion has already started.
type ChildFolder struct {
	UID         string
	Terminating bool
}

// CascadeFolders is the folder API surface the async reconciler drives to walk and drain a subtree
// marked terminating by async cascade delete.
type CascadeFolders interface {
	// Terminating lists the UIDs of folders marked folder-terminating=true in the org.
	Terminating(ctx context.Context, orgID int64) ([]string, error)
	// Children returns the direct child folders that still exist under folderUID.
	Children(ctx context.Context, orgID int64, folderUID string) ([]ChildFolder, error)
	// Delete starts async cascade deletion of a child folder (marks it terminating).
	Delete(ctx context.Context, orgID int64, folderUID string) error
	// RemoveFinalizer clears the cascade finalizer, which fully deletes the folder.
	RemoveFinalizer(ctx context.Context, orgID int64, folderUID string) error
	// MarkFailed records a failure status and message on the folder so the block is observable.
	MarkFailed(ctx context.Context, orgID int64, folderUID, reason string) error
}

// AsyncReconciler drains folders marked terminating: it deletes leaves' contained resources, cascades
// deletion down to children, and removes the finalizer once a folder is empty. registry.BackgroundService.
type AsyncReconciler struct {
	folders   CascadeFolders
	orgs      orgLister
	consumers []Consumer
	interval  time.Duration
	log       log.Logger
}

func newAsyncReconciler(folders CascadeFolders, orgs orgLister, interval time.Duration, consumers ...Consumer) *AsyncReconciler {
	if interval <= 0 {
		interval = time.Minute
	}
	return &AsyncReconciler{
		folders:   folders,
		orgs:      orgs,
		consumers: consumers,
		interval:  interval,
		log:       log.New("folder-async-reconciler"),
	}
}

func (r *AsyncReconciler) IsDisabled() bool {
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(), featuremgmt.FlagDeletedFolderResourceCleanupAsync, false, openfeature.EvaluationContext{})
	return !enabled
}

func (r *AsyncReconciler) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := r.reconcile(ctx); err != nil {
				r.log.Error("Folder async reconcile failed", "error", err)
			}
		}
	}
}

func (r *AsyncReconciler) reconcile(ctx context.Context) error {
	orgs, err := r.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}
	for _, o := range orgs {
		if err := r.reconcileOrg(ctx, o.ID); err != nil {
			r.log.Error("Failed to reconcile org", "org_id", o.ID, "error", err)
		}
	}
	return nil
}

func (r *AsyncReconciler) reconcileOrg(ctx context.Context, orgID int64) error {
	// Authenticate as the Grafana system identity so folder calls reach the (multi-tenant) folder app server.
	ctx, _ = identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-async-reconciler"))

	uids, err := r.folders.Terminating(ctx, orgID)
	if err != nil {
		return err
	}
	for _, uid := range uids {
		if err := r.reconcileFolder(ctx, orgID, uid); err != nil {
			r.log.Error("Failed to reconcile terminating folder", "org_id", orgID, "folder_uid", uid, "error", err)
		}
	}
	return nil
}

// reconcileFolder advances a single terminating folder by one step: cascade to remaining children, or
// once it is a leaf, delete its contents in order and drop the finalizer. It processes one level per tick.
func (r *AsyncReconciler) reconcileFolder(ctx context.Context, orgID int64, uid string) error {
	children, err := r.folders.Children(ctx, orgID, uid)
	if err != nil {
		return err
	}
	// Not a leaf yet: start deletion on any child not already terminating, then wait for the next tick.
	if len(children) > 0 {
		for _, c := range children {
			if c.Terminating {
				continue
			}
			if err := r.folders.Delete(ctx, orgID, c.UID); err != nil {
				return err
			}
		}
		return nil
	}

	// Leaf: delete contained resources in order; on failure mark the folder and stop for this tick.
	for _, c := range r.consumers {
		if err := c.DeleteInFolder(ctx, orgID, uid); err != nil {
			r.log.Error("Failed to delete folder contents", "consumer", c.Name(), "org_id", orgID, "folder_uid", uid, "error", err)
			return r.folders.MarkFailed(ctx, orgID, uid, fmt.Sprintf("%s: %v", c.Name(), err))
		}
	}
	// Contents cleared: dropping the finalizer lets the API server fully delete the folder.
	return r.folders.RemoveFinalizer(ctx, orgID, uid)
}
