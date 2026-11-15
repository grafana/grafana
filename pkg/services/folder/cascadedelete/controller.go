package cascadedelete

import (
	"context"
	"errors"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
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
//
// The initial list is not a source of work: a folder that was terminating when the controller
// started, such as after a restart mid-cascade, waits for its next change. This is temporary; see
// Handler.
type Controller struct {
	folders    FolderGetter
	reconciler *Reconciler
	queue      workqueue.TypedRateLimitingInterface[string]

	mu sync.Mutex
	// seen lets a resync that repeats a folder's last version be dropped without reading it.
	seen map[string]string
	// waiting is the terminating folders a resync must retry: nothing names them when a subfolder goes.
	waiting map[string]struct{}
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
		seen:       map[string]string{},
		waiting:    map[string]struct{}{},
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

// Handler enqueues the folder behind each event, except a resync repeating a folder's last version
// when it is not waiting. An event without a resource version is always enqueued.
//
// The initial list is only recorded, so starting costs no read per folder. That list names folders
// but not which are terminating, so a cascade interrupted by a restart is not resumed until the
// folder changes again, and resyncs drop it because its version is unchanged.
//
// TODO(filewalkwithme): resume such folders, for example with a startup pass over recently changed
// folders or a slow sweep.
func (c *Controller) Handler() cache.ResourceEventHandler {
	return handler{c}
}

type handler struct{ c *Controller }

func (h handler) OnAdd(obj any, isInInitialList bool) {
	if isInInitialList {
		h.c.record(obj)
		return
	}
	h.c.enqueue(obj, false)
}

// OnUpdate ignores the old object: the NATS informer passes the same one for live changes and
// resyncs, so only the controller's own record can tell them apart.
func (h handler) OnUpdate(_, obj any) { h.c.enqueue(obj, false) }

func (h handler) OnDelete(obj any) { h.c.enqueue(obj, true) }

// record remembers a folder's version without enqueueing it.
func (c *Controller) record(obj any) {
	key, ok := eventKey(obj)
	if !ok {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.remember(key, resourceVersion(obj))
}

// remember stores the folder's version and returns the one it replaced. A folder with no version is
// forgotten, so a stale one cannot match a later event. The caller holds c.mu.
func (c *Controller) remember(key, rv string) (prev string, known bool) {
	prev, known = c.seen[key]
	if rv == "" {
		delete(c.seen, key)
	} else {
		c.seen[key] = rv
	}
	return prev, known
}

func eventKey(obj any) (string, bool) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		logging.DefaultLogger.Warn("Folder cascade delete: cannot key event object", "error", err)
		return "", false
	}
	return key, true
}

func resourceVersion(obj any) string {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}
	if acc, err := meta.Accessor(obj); err == nil {
		return acc.GetResourceVersion()
	}
	return ""
}

func (c *Controller) enqueue(obj any, deleted bool) {
	key, ok := eventKey(obj)
	if !ok {
		return
	}
	if c.trackEvent(key, obj, deleted) {
		return
	}
	c.queue.Add(key)
}

// trackEvent records the event and reports whether it only repeats the folder's last version.
func (c *Controller) trackEvent(key string, obj any, deleted bool) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if deleted {
		delete(c.seen, key)
		delete(c.waiting, key)
		return false
	}
	rv := resourceVersion(obj)
	prev, known := c.remember(key, rv)
	if rv == "" {
		return false
	}
	_, waiting := c.waiting[key]
	return known && prev == rv && !waiting
}

func (c *Controller) setWaiting(key string, waiting bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if waiting {
		c.waiting[key] = struct{}{}
		return
	}
	delete(c.waiting, key)
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
		c.setWaiting(key, false)
		c.queue.Forget(key)
		return true
	}
	if err != nil {
		logger.Warn("Folder cascade delete: get folder", "error", err)
		c.queue.AddRateLimited(key)
		return true
	}

	c.setWaiting(key, cascadePending(f))
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
		c.setWaiting(key, false)
		c.queue.Forget(key)
		if parent := f.Annotations[utils.AnnoKeyFolder]; parent != "" {
			c.queue.Add(namespace + "/" + parent)
		}
	default:
		c.queue.Forget(key)
	}
	return true
}
