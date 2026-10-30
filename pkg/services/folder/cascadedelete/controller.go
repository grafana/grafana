package cascadedelete

import (
	"context"
	"errors"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DefaultWorkers is how many folders are reconciled concurrently.
const DefaultWorkers = 4

// ResyncPeriod is how often the event source re-delivers every folder. It is only a backstop for
// events the controller missed; progress is driven by requeues, not by it.
const ResyncPeriod = 10 * time.Minute

// DefaultRateLimiter backs off a folder whose pass failed or only found children the index still
// lists after they were deleted. Progress never goes through it, so a cascade that is making
// progress is never slowed down.
func DefaultRateLimiter() workqueue.TypedRateLimiter[string] {
	return workqueue.NewTypedItemExponentialFailureRateLimiter[string](5*time.Millisecond, 1000*time.Second)
}

// Controller drives Reconcile from folder events. A folder is requeued right after a pass that
// issued deletes, and a folder whose cascade is released wakes its parent, so a parent waiting on
// its subfolders does no work until one of them finishes. Nothing polls: workers block on the
// queue, and only errors are retried after a delay.
//
// Event sources deliver only a folder's namespace and name, so the handler enqueues every folder
// event and the worker reads the folder before reconciling it.
//
// Only the release of a subfolder's cascade wakes its parent. A subfolder held by another finalizer
// after that disappears later with no event naming its parent, so that parent is picked up again
// only by the event source's periodic resync.
type Controller struct {
	folders    FolderGetter
	reconciler *Reconciler
	queue      workqueue.TypedRateLimitingInterface[string]
}

// NewController builds a controller. A nil limiter uses DefaultRateLimiter. The queue starts its
// own goroutine at once, so a controller must be Run, and Run only once: it shuts the queue down
// when its context ends.
func NewController(folders FolderGetter, r *Reconciler, limiter workqueue.TypedRateLimiter[string]) *Controller {
	if limiter == nil {
		limiter = DefaultRateLimiter()
	}
	return &Controller{
		folders:    folders,
		reconciler: r,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(limiter, workqueue.TypedRateLimitingQueueConfig[string]{
			Name: "folder_cascade_delete",
		}),
	}
}

// NewDefaultController assembles the controller every entry point runs, so they cannot drift:
// children are found through searcher, and deleted and folders written through dyn.
func NewDefaultController(dyn dynamic.Interface, searcher resourcepb.ResourceIndexClient) *Controller {
	clients := NewDynamicClients(dyn)
	r := &Reconciler{Children: NewSearchChildLister(searcher), Deleter: clients, Folders: clients}
	return NewController(clients, r, nil)
}

// Handler enqueues the folder behind every add, update and delete event.
func (c *Controller) Handler() cache.ResourceEventHandler {
	return cache.ResourceEventHandlerFuncs{
		AddFunc:    c.enqueue,
		UpdateFunc: func(_, obj any) { c.enqueue(obj) },
		DeleteFunc: c.enqueue,
	}
}

func (c *Controller) enqueue(obj any) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		logging.DefaultLogger.Warn("Folder cascade delete: cannot key event object", "error", err)
		return
	}
	c.queue.Add(key)
}

// ShutDown stops the queue. Run does it when its context ends; a caller that fails before reaching
// Run needs it so the queue's goroutines do not outlive the controller.
func (c *Controller) ShutDown() {
	c.queue.ShutDown()
}

// Run processes the queue with the given number of workers until ctx is done.
func (c *Controller) Run(ctx context.Context, workers int) {
	var wg sync.WaitGroup
	for range max(workers, 1) {
		wg.Go(func() {
			defer utilruntime.HandleCrash()
			for c.processNext(ctx) {
			}
		})
	}
	<-ctx.Done()
	c.queue.ShutDown()
	wg.Wait()
}

func (c *Controller) processNext(ctx context.Context) bool {
	key, shutdown := c.queue.Get()
	if shutdown {
		return false
	}
	defer c.queue.Done(key)
	// ShutDown still hands out the keys left in the queue; with the context gone they could only fail.
	if ctx.Err() != nil {
		return false
	}

	logger := logging.FromContext(ctx).With("key", key)
	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		logger.Warn("Folder cascade delete: invalid key", "error", err)
		c.queue.Forget(key)
		return true
	}

	// ParseNamespace never fails: a namespace it does not recognize comes back with no org.
	ns, _ := authlib.ParseNamespace(namespace)
	if ns.OrgID < 1 {
		// Forgotten for good, so the folder stays terminating: an error, with the folder named, so it can be found.
		logger.Error("Folder cascade delete: skipping folder, its namespace has no org to run as", "namespace", namespace, "folder", name)
		c.queue.Forget(key)
		return true
	}
	// Search is scoped to the requester, and the remote storage client refuses a call with no identity
	// at all, so a folder is reconciled as the service for its own namespace.
	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID)

	f, err := c.folders.Get(ctx, namespace, name)
	if apierrors.IsNotFound(err) {
		c.queue.Forget(key)
		return true
	}
	if err != nil {
		logger.Warn("Folder cascade delete: get folder", "error", err)
		c.queue.AddRateLimited(key)
		return true
	}

	res, err := c.reconciler.Reconcile(ctx, f)
	switch {
	case errors.Is(err, ErrChildrenStillListed):
		logger.Debug("Folder cascade delete: waiting for search to drop deleted children")
		c.queue.AddRateLimited(key)
	case err != nil:
		logger.Warn("Folder cascade delete pass failed", "error", err)
		c.queue.AddRateLimited(key)
	case res.Requeue:
		c.queue.Forget(key)
		c.queue.Add(key)
	case res.Released:
		c.queue.Forget(key)
		if parent := f.Annotations[utils.AnnoKeyFolder]; parent != "" {
			c.queue.Add(namespace + "/" + parent)
		}
	default:
		c.queue.Forget(key)
	}
	return true
}
