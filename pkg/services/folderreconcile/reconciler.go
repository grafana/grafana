// Package folderreconcile provides a periodic background job that deletes resources
// left behind when their containing folder is removed. Each resource type plugs in as
// a Consumer; the reconciler handles org iteration, folder search and the safety re-check.
package folderreconcile

import (
	"context"
	"errors"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// lockActionName identifies this job's row in the server_lock table.
const lockActionName = "folder-reconciler"

// minInterval keeps every replica from hitting the folder API and the server_lock table too often
// across a large multi-tenant fleet.
const minInterval = 5 * time.Minute

// passTimeoutMargin leaves headroom before the lock's maxInterval elapses, mirroring
// dashboard_service.go's cleanupTimeout calculation.
const passTimeoutMargin = 5 * time.Second

// serverLock is the subset of serverlock.ServerLockService used here, so tests can fake it.
type serverLock interface {
	LockAndExecute(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

// Consumer is implemented by each resource type that stores resources inside folders.
type Consumer interface {
	// Name identifies the consumer in logs.
	Name() string
	// FoldersInUse returns the distinct folder UIDs referenced by the consumer's resources in the org.
	FoldersInUse(ctx context.Context, orgID int64) ([]string, error)
	// DeleteInFolder removes the consumer's resources contained in the given folder.
	DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error
}

type orgLister interface {
	Search(ctx context.Context, q *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// Reconciler is a registry.BackgroundService.
type Reconciler struct {
	consumers []Consumer
	folders   folder.Service
	orgs      orgLister
	lock      serverLock
	interval  time.Duration
	log       log.Logger
}

// ProvideReconciler wires the reconciler with its concrete consumers. Add new consumers here.
func ProvideReconciler(
	cfg *setting.Cfg,
	folders folder.Service,
	orgs org.Service,
	lock *serverlock.ServerLockService,
	alertRules *ngalert.AlertRuleFolderConsumer,
	libraryPanels *libraryelements.FolderConsumer,
) *Reconciler {
	interval := cfg.SectionWithEnvOverrides("folder").Key("deleted_resource_cleanup_interval").MustDuration(minInterval)
	return newReconciler(folders, orgs, lock, interval, alertRules, libraryPanels)
}

func newReconciler(folders folder.Service, orgs orgLister, lock serverLock, interval time.Duration, consumers ...Consumer) *Reconciler {
	l := log.New("folder-reconciler")
	if interval < minInterval {
		l.Warn("[folder.deleted_resource_cleanup_interval] is too low; the minimum allowed is enforced", "minimum", minInterval)
		interval = minInterval
	}
	return &Reconciler{
		consumers: consumers,
		folders:   folders,
		orgs:      orgs,
		lock:      lock,
		interval:  interval,
		log:       l,
	}
}

func (r *Reconciler) IsDisabled() bool {
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(), featuremgmt.FlagDeletedFolderResourceCleanup, false, openfeature.EvaluationContext{})
	return !enabled
}

func (r *Reconciler) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			r.tick(ctx)
		}
	}
}

// tick runs one reconcile pass under the server lock, so only one replica per tenant reconciles per
// interval regardless of how many replicas tick. maxInterval == r.interval on purpose: LockAndExecute
// skips work started less than maxInterval ago, which is what caps the actual run frequency. The pass
// itself is bounded to the same duration, so it can never still be running once the lease goes stale.
func (r *Reconciler) tick(ctx context.Context) {
	err := r.lock.LockAndExecute(ctx, lockActionName, r.interval, func(ctx context.Context) {
		ctx, cancel := context.WithTimeout(ctx, r.interval-passTimeoutMargin)
		defer cancel()
		if err := r.reconcile(ctx); err != nil {
			r.log.Error("Folder reconcile failed", "error", err)
		}
	})
	if err != nil {
		r.log.Error("Failed to acquire folder reconciler lock", "error", err)
	}
}

func (r *Reconciler) reconcile(ctx context.Context) error {
	orgs, err := r.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}
	for _, o := range orgs {
		// Stop cleanly at an org boundary rather than letting the deadline cut off mid-org;
		// the remaining orgs are picked up on the next tick.
		if ctx.Err() != nil {
			r.log.Warn("Reconcile pass ran out of time, resuming next tick")
			break
		}
		if err := r.reconcileOrg(ctx, o.ID); err != nil {
			r.log.Error("Failed to reconcile org", "org_id", o.ID, "error", err)
		}
	}
	return nil
}

type consumerFolders struct {
	consumer Consumer
	uids     []string
}

func (r *Reconciler) reconcileOrg(ctx context.Context, orgID int64) error {
	// Authenticate as the Grafana system identity so folder calls reach the (multi-tenant) folder app server.
	ctx, user := identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-reconciler"))

	// Collect the distinct folder UIDs each consumer references, ignoring the root/general folder.
	all := map[string]struct{}{}
	perConsumer := make([]consumerFolders, 0, len(r.consumers))
	for _, c := range r.consumers {
		uids, err := c.FoldersInUse(ctx, orgID)
		if err != nil {
			r.log.Error("Failed to list folders in use", "consumer", c.Name(), "org_id", orgID, "error", err)
			continue
		}
		kept := make([]string, 0, len(uids))
		for _, uid := range uids {
			if uid == "" || uid == folder.GeneralFolderUID {
				continue
			}
			kept = append(kept, uid)
			all[uid] = struct{}{}
		}
		perConsumer = append(perConsumer, consumerFolders{consumer: c, uids: kept})
	}
	if len(all) == 0 {
		return nil
	}

	uids := make([]string, 0, len(all))
	for uid := range all {
		uids = append(uids, uid)
	}
	// Search the folder API server for which referenced folders still exist.
	hits, err := r.folders.SearchFolders(ctx, folder.SearchFoldersQuery{OrgID: orgID, UIDs: uids, SignedInUser: user})
	if err != nil {
		return err
	}
	existing := make(map[string]struct{}, len(hits))
	for _, h := range hits {
		existing[h.UID] = struct{}{}
	}

	// A folder missing from search is only treated as gone once a direct Get confirms it.
	missing := map[string]bool{}
	for uid := range all {
		if _, ok := existing[uid]; ok {
			continue
		}
		if _, err := r.folders.Get(ctx, &folder.GetFolderQuery{OrgID: orgID, UID: &uid, SignedInUser: user}); errors.Is(err, dashboards.ErrFolderNotFound) {
			missing[uid] = true
		}
	}
	if len(missing) == 0 {
		return nil
	}

	for _, cf := range perConsumer {
		for _, uid := range cf.uids {
			if !missing[uid] {
				continue
			}
			if err := cf.consumer.DeleteInFolder(ctx, orgID, uid); err != nil {
				r.log.Error("Failed to delete resources in deleted folder", "consumer", cf.consumer.Name(), "org_id", orgID, "folder_uid", uid, "error", err)
				continue
			}
			r.log.Info("Deleted resources in deleted folder", "consumer", cf.consumer.Name(), "org_id", orgID, "folder_uid", uid)
		}
	}
	return nil
}
