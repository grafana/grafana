package folders

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/retry"
	"k8s.io/client-go/util/workqueue"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// cascadeDeleteControllerBatchSize bounds how many direct children (subfolders + dashboards) the
// controller deletes per reconcile pass, so a folder with many children makes visible, incremental
// progress (status.cascadeDelete.remaining ticks down) instead of one huge, un-interruptible pass.
const cascadeDeleteControllerBatchSize = 50

// CascadeDeleteController is a PoC, finalizer-driven controller that asynchronously deletes a
// folder's direct children (subfolders and dashboards) once the folder both carries
// foldersv1.CascadeDeleteFinalizer and has been marked for deletion, removing the finalizer once
// there is nothing left so the apiserver can finish deleting the folder itself.
//
// This exists to validate an alternative to the existing synchronous, in-request cascade delete
// (cascade_delete_storage.go), which walks and deletes an entire subtree inline in the DELETE
// HTTP call. Gated independently behind featuremgmt.FlagKubernetesFolderCascadeDeleteAsync.
//
// This controller only ever processes one folder's *direct* children per reconcile pass -- it does
// not walk a whole subtree in one go. Deep subtrees still complete correctly, though: deleting a
// child folder that itself carries the cascade-delete finalizer (see validateOnDelete's bypass in
// validate.go) sets *its* deletionTimestamp rather than removing it outright (standard apiserver
// finalizer semantics), which the informer delivers back to this same controller as its own key --
// so a deep subtree resolves bottom-up as a chain of independent reconciles, one per folder,
// without any one pass needing to know about more than its immediate children. This only holds for
// folders that carry the finalizer; see the backfill limitation below.
//
// PoC scope -- deliberately NOT implemented (see the PR description for the full list):
//   - Backfill: only folders created after the flag was enabled carry the finalizer (stamped by
//     admission in register.go's Mutate). A pre-existing folder without the finalizer that turns up
//     as a non-empty child is left alone by this controller (deleteChildFolder's plain Delete is
//     rejected by validateOnDelete, same as it would be for any ordinary non-empty-folder delete
//     today) and surfaces as a persistent per-child error in status.cascadeDelete.errors -- it must
//     be handled via the existing synchronous force-delete flag (kubernetesFolderCascadeDelete)
//     instead, or emptied out-of-band.
//   - Alert rules and library elements are not cleaned up (dashboards + subfolders only).
//   - Orphan detection/recovery and propagationPolicy handling.
//   - Bubbling errors up to an ancestor folder's own cascade delete.
type CascadeDeleteController struct {
	folders         dynamic.NamespaceableResourceInterface
	dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)
	searcher        resourcepb.ResourceIndexClient

	queue  workqueue.TypedRateLimitingInterface[string]
	logger logging.Logger

	// batchSize defaults to cascadeDeleteControllerBatchSize; overridable in tests.
	batchSize int
}

// NewCascadeDeleteController builds a CascadeDeleteController. folders must be a client for the
// Folder resource (any version -- v1 and v1beta1 are the same underlying storage);
// dashboardClient mirrors cascadeDeleteStorage's lazy dashboard client and may return a nil client
// to skip dashboard cleanup (e.g. no dashboard apiserver configured).
func NewCascadeDeleteController(
	folders dynamic.NamespaceableResourceInterface,
	dashboardClient func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error),
	searcher resourcepb.ResourceIndexClient,
) *CascadeDeleteController {
	return &CascadeDeleteController{
		folders:         folders,
		dashboardClient: dashboardClient,
		searcher:        searcher,
		queue: workqueue.NewTypedRateLimitingQueue[string](
			workqueue.DefaultTypedControllerRateLimiter[string](),
		),
		logger:    logging.DefaultLogger.With("logger", "folder-cascade-delete-controller"),
		batchSize: cascadeDeleteControllerBatchSize,
	}
}

// EventHandler returns the informer event handlers to register with a Folder informer: any
// add/update enqueues the key, and reconcile decides whether there's cascade-delete work to do
// (deletionTimestamp set and our finalizer present). No DeleteFunc: by the time an object is
// actually removed from storage, our finalizer has already been cleared by this same controller,
// so there is nothing left to react to.
func (c *CascadeDeleteController) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj any) { c.enqueue(obj) },
		UpdateFunc: func(_, newObj any) { c.enqueue(newObj) },
	}
}

func (c *CascadeDeleteController) enqueue(obj any) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("cascade delete controller: %w", err))
		return
	}
	c.queue.Add(key)
}

// Run starts workerCount workers processing the queue until ctx is cancelled. onStarted is called
// once the workers are launched, onShutdown as soon as ctx is cancelled (before workers drain) --
// mirroring RepositoryController.Run's shape so callers (the apiserver post-start hook in
// register.go, and the standalone folder operator in pkg/operators/folder) can hook readiness
// reporting the same way.
func (c *CascadeDeleteController) Run(ctx context.Context, workerCount int, onStarted func(), onShutdown func()) {
	defer utilruntime.HandleCrash()
	defer c.queue.ShutDown()

	c.logger.Info("starting folder cascade delete controller", "workers", workerCount)
	for i := 0; i < workerCount; i++ {
		go wait.UntilWithContext(ctx, c.runWorker, time.Second)
	}
	onStarted()

	<-ctx.Done()
	onShutdown()
}

func (c *CascadeDeleteController) runWorker(ctx context.Context) {
	for c.processNextItem(ctx) {
	}
}

func (c *CascadeDeleteController) processNextItem(ctx context.Context) bool {
	key, quit := c.queue.Get()
	if quit {
		return false
	}
	defer c.queue.Done(key)

	if err := c.reconcile(ctx, key); err != nil {
		utilruntime.HandleError(fmt.Errorf("cascade delete controller: reconcile %q: %w", key, err))
		c.queue.AddRateLimited(key)
		return true
	}
	c.queue.Forget(key)
	return true
}

// reconcile processes one folder key. It requeues itself (rather than waiting on the next informer
// event or resync) as long as there is more cascade-delete work to do, so a multi-batch delete
// makes steady progress without depending on the resync period.
func (c *CascadeDeleteController) reconcile(ctx context.Context, key string) error {
	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	// The informer/workqueue context carries no requester or claims (unlike an HTTP request context),
	// but c.searcher's internal search/index calls require them. Run as a service identity for the
	// whole reconcile, same as cascade_delete_storage.go's synchronous cascade does -- there isn't a
	// specific end user to run this as anyway, since deletion is deferred/asynchronous by the time
	// this runs.
	nsInfo, err := claims.ParseNamespace(namespace)
	if err != nil {
		return fmt.Errorf("parse namespace %q: %w", namespace, err)
	}
	ctx = identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)

	obj, err := c.folders.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("get folder: %w", err)
	}

	if obj.GetDeletionTimestamp() == nil {
		return nil
	}
	if !slices.Contains(obj.GetFinalizers(), foldersv1.CascadeDeleteFinalizer) {
		return nil
	}

	children, err := listChildFolders(ctx, c.searcher, namespace, name)
	if err != nil {
		return fmt.Errorf("list child folders: %w", err)
	}
	dashboards, err := listDashboardsInFolder(ctx, c.searcher, namespace, name)
	if err != nil {
		return fmt.Errorf("list dashboards: %w", err)
	}
	remaining := len(children) + len(dashboards)

	if remaining == 0 {
		if err := c.writeStatus(ctx, obj, foldersv1.CascadeDeleteStatus{
			State:    foldersv1.CascadeDeleteStateSuccess,
			Started:  existingCascadeDeleteStarted(obj),
			Finished: time.Now().UnixMilli(),
		}); err != nil {
			// Non-fatal: the finalizer removal below is what actually lets deletion complete: a
			// folder stuck on a failed status write but with the finalizer cleared is still fine.
			c.logger.Warn("failed to write final cascade delete status", "namespace", namespace, "name", name, "error", err)
		}
		return c.removeFinalizer(ctx, namespace, name)
	}

	started := existingCascadeDeleteStarted(obj)
	if started == 0 {
		started = time.Now().UnixMilli()
	}
	if err := c.writeStatus(ctx, obj, foldersv1.CascadeDeleteStatus{
		State:     foldersv1.CascadeDeleteStateWorking,
		Remaining: int64(remaining),
		Started:   started,
	}); err != nil {
		c.logger.Warn("failed to write cascade delete status", "namespace", namespace, "name", name, "error", err)
	}

	var errs []string
	deleted := 0
	for _, childUID := range children {
		if deleted >= c.batchSize {
			break
		}
		if err := c.deleteChildFolder(ctx, namespace, childUID); err != nil {
			errs = append(errs, fmt.Sprintf("delete child folder %s: %v", childUID, err))
			continue
		}
		deleted++
	}
	for _, dashUID := range dashboards {
		if deleted >= c.batchSize {
			break
		}
		if err := c.deleteDashboard(ctx, namespace, dashUID); err != nil {
			errs = append(errs, fmt.Sprintf("delete dashboard %s: %v", dashUID, err))
			continue
		}
		deleted++
	}

	if len(errs) > 0 {
		// PoC: the error list is overwritten each pass rather than accumulated, and a child that
		// keeps failing (e.g. a non-empty subfolder, see the type doc) has no max-attempts/backoff
		// policy beyond the workqueue's own rate limiting on the parent key.
		if err := c.writeStatus(ctx, obj, foldersv1.CascadeDeleteStatus{
			State:     foldersv1.CascadeDeleteStateError,
			Remaining: int64(remaining - deleted),
			Started:   started,
			Errors:    errs,
		}); err != nil {
			c.logger.Warn("failed to write cascade delete error status", "namespace", namespace, "name", name, "error", err)
		}
	}

	// Requeue immediately for the next batch instead of waiting for the next informer event or the
	// periodic resync (which remains as a backstop for anything this misses).
	c.queue.Add(key)
	return nil
}

// deleteChildFolder deletes a direct child folder without forcing (gracePeriodSeconds=0). An empty
// child, or one that itself carries the cascade-delete finalizer, has its delete accepted (the
// latter only sets deletionTimestamp -- see the CascadeDeleteController doc comment); a non-empty
// child that lacks the finalizer is rejected by the existing admission validation.
func (c *CascadeDeleteController) deleteChildFolder(ctx context.Context, namespace, name string) error {
	err := c.folders.Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

// deleteDashboard deletes a direct dashboard child, mirroring cascade_delete_storage.go's
// tolerance of a NotFound (stale index entry) and of no dashboard client being configured.
func (c *CascadeDeleteController) deleteDashboard(ctx context.Context, namespace, name string) error {
	client, err := c.dashboardClient(ctx)
	if err != nil {
		return fmt.Errorf("get dashboard client: %w", err)
	}
	if client == nil {
		return nil
	}
	err = (*client).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

// writeStatus sets status.cascadeDelete on a copy of obj and writes it through the status
// subresource. obj is not mutated in place so callers keep working from the version they read at
// the top of reconcile.
func (c *CascadeDeleteController) writeStatus(ctx context.Context, obj *unstructured.Unstructured, status foldersv1.CascadeDeleteStatus) error {
	// runtime.DefaultUnstructuredConverter (rather than a plain encoding/json round-trip) preserves
	// int64 fields as int64 in the resulting map; a JSON round-trip would decode them as float64,
	// which unstructured.NestedInt64 (used by existingCascadeDeleteStarted below, and by tests) rejects.
	statusMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&status)
	if err != nil {
		return fmt.Errorf("convert cascade delete status: %w", err)
	}

	updated := obj.DeepCopy()
	if err := unstructured.SetNestedMap(updated.Object, statusMap, "status", "cascadeDelete"); err != nil {
		return fmt.Errorf("set cascade delete status: %w", err)
	}
	_, err = c.folders.Namespace(obj.GetNamespace()).UpdateStatus(ctx, updated, metav1.UpdateOptions{})
	return err
}

// existingCascadeDeleteStarted reads status.cascadeDelete.started off obj, or 0 if unset -- used to
// preserve the original start time across multiple reconcile passes of the same delete.
func existingCascadeDeleteStarted(obj *unstructured.Unstructured) int64 {
	started, found, err := unstructured.NestedInt64(obj.Object, "status", "cascadeDelete", "started")
	if err != nil || !found {
		return 0
	}
	return started
}

// removeFinalizer removes just foldersv1.CascadeDeleteFinalizer (preserving any other finalizers)
// via a JSON patch to metadata.finalizers, mirroring how the provisioning RepositoryController's
// finalizer processing removes its finalizers once done. Retries on conflict since the read
// (current finalizer list) and the patch aren't atomic.
func (c *CascadeDeleteController) removeFinalizer(ctx context.Context, namespace, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := c.folders.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}

		finalizers := obj.GetFinalizers()
		idx := slices.Index(finalizers, foldersv1.CascadeDeleteFinalizer)
		if idx < 0 {
			return nil
		}
		remaining := slices.Delete(slices.Clone(finalizers), idx, idx+1)

		patch, err := json.Marshal([]map[string]any{{
			"op":    "replace",
			"path":  "/metadata/finalizers",
			"value": remaining,
		}})
		if err != nil {
			return err
		}
		_, err = c.folders.Namespace(namespace).Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{})
		return err
	})
}
