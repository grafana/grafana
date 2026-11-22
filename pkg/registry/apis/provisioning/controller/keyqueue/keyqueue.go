// Package keyqueue runs the worker loop shared by the repository and connection
// controllers: informer deliveries enqueue an object's namespace/name key, a pool
// of workers reconciles each key, and transient failures are retried with
// backoff. Repeated deliveries coalesce onto a key that is still queued or in
// flight, so a burst of events costs one reconcile.
package keyqueue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/utils/clock"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// ProcessFunc reconciles the object behind key. The returned fields are added
// to the outcome log lines.
type ProcessFunc func(ctx context.Context, key string) (logFields []any, err error)

type Config struct {
	// Controller names the controller in logs, e.g. "RepositoryController".
	Controller string
	// Kind names the keyed object in logs and in the queue metric names, e.g.
	// "repository" for grafana_provisioning_repository_worker_queue_size.
	Kind      string
	Logger    logging.Logger
	Registry  prometheus.Registerer
	Processed *usinformer.ProcessedMetrics
	// MaxAttempts bounds how often one delivery is processed, retries included.
	MaxAttempts int
	// Retryable reports whether a failure is transient and worth a
	// rate-limited retry. Other failures wait for the next delivery.
	Retryable    func(error) bool
	DrainTimeout time.Duration
	// RateLimiter and Clock default to client-go's controller rate limiter and
	// the real clock.
	RateLimiter workqueue.TypedRateLimiter[string]
	Clock       clock.WithTicker
}

type Workers struct {
	cfg     Config
	process ProcessFunc
	queue   workqueue.TypedRateLimitingInterface[string]
	lag     queueLagTracker

	// triggers carries each key's attribution from enqueue to pickup. Entries
	// live only between enqueue and the pickup that pops them.
	triggersMu sync.Mutex
	triggers   map[string]usinformer.ProcessTrigger
}

func New(cfg Config, process ProcessFunc) *Workers {
	if cfg.RateLimiter == nil {
		cfg.RateLimiter = workqueue.DefaultTypedControllerRateLimiter[string]()
	}
	w := &Workers{
		cfg:      cfg,
		process:  process,
		triggers: make(map[string]usinformer.ProcessTrigger),
	}
	queueConfig := workqueue.TypedQueueConfig[string]{
		Name:            "provisioning" + cfg.Controller,
		MetricsProvider: newWorkerQueueWaitProvider(cfg.Registry, cfg.Kind),
	}
	if cfg.Clock != nil {
		queueConfig.Clock = cfg.Clock
	}
	w.queue = newWorkerQueue(&w.lag, cfg.RateLimiter, queueConfig)

	// The queue is per replica, so Prometheus target labels distinguish
	// replicas. GaugeFuncs read the authoritative state at scrape time, so they
	// cannot drift the way manual inc/dec would.
	cfg.Registry.MustRegister(prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_" + cfg.Kind + "_worker_queue_size",
			Help: "Number of " + cfg.Kind + " keys waiting in this replica's local work queue",
		},
		func() float64 { return float64(w.queue.Len()) },
	))
	// Unlike the pickup-observed wait histogram, lag climbs live, so a stalled
	// queue or a saturated worker pool shows up even after the queue drained.
	cfg.Registry.MustRegister(prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_" + cfg.Kind + "_worker_queue_lag_seconds",
			Help: "Age in seconds of the oldest unfinished " + cfg.Kind + " queue entry (waiting or in flight) in this replica, measured from that entry's enqueue, excluding retry backoff.",
		},
		func() float64 { return w.lag.lag().Seconds() },
	))
	return w
}

// Queue is the underlying work queue, for reschedules such as AddAfter.
// A key added directly carries no trigger and is not counted as processed.
func (w *Workers) Queue() workqueue.TypedRateLimitingInterface[string] {
	return w.queue
}

// Lag is the age of the oldest unfinished key, excluding retry backoff.
func (w *Workers) Lag() time.Duration {
	return w.lag.lag()
}

// EventHandler enqueues objects on add and update. Deletes need no handler:
// the controllers act on deletion through finalizers, seen as updates.
func (w *Workers) EventHandler() cache.ResourceEventHandlerDetailedFuncs {
	return cache.ResourceEventHandlerDetailedFuncs{
		AddFunc: func(obj any, isInInitialList bool) {
			w.enqueue(obj, w.cfg.Processed.ClassifyAdd(resourceVersion(obj), isInInitialList))
		},
		UpdateFunc: func(oldObj, newObj any) {
			w.enqueue(newObj, w.cfg.Processed.ClassifyUpdate(resourceVersion(oldObj), resourceVersion(newObj)))
		},
	}
}

// resourceVersion returns the resource version of a delivered object, or "" for
// a delete tombstone.
func resourceVersion(obj any) string {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return ""
	}
	return acc.GetResourceVersion()
}

func (w *Workers) enqueue(obj any, trigger usinformer.ProcessTrigger) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("couldn't get key for object: %v", err))
		return
	}
	// Attribute the key before the enqueue so a worker that dequeues immediately
	// sees it.
	w.setTrigger(key, trigger)
	w.queue.Add(key)
	namespace, name, _ := cache.SplitMetaNamespaceKey(key)
	// Log lag at enqueue so backlog is visible on add, not only at pickup.
	w.cfg.Logger.Info(w.cfg.Controller+" enqueued key",
		"work_key", key, "namespace", namespace, w.cfg.Kind, name,
		"queue_len", w.queue.Len(), "queue_lag", w.lag.lag())
}

// setTrigger records what enqueued key, first-wins: the enqueue that first
// queued the key owns the attribution, and later deliveries that coalesce onto
// the still-queued key (or a retry re-set) leave it alone.
func (w *Workers) setTrigger(key string, trigger usinformer.ProcessTrigger) {
	w.triggersMu.Lock()
	defer w.triggersMu.Unlock()
	if _, ok := w.triggers[key]; !ok {
		w.triggers[key] = trigger
	}
}

// popTrigger reads and removes key's attribution. Each pickup pops its own
// entry up front, so the entry never outlives the key however the pickup ends,
// and a concurrent enqueue that races an in-flight reconcile (setting a fresh
// entry and marking the key dirty, e.g. a status update the reconcile itself
// produced) keeps its attribution for the redelivery, which a terminal
// queue.Forget must not clobber.
func (w *Workers) popTrigger(key string) (usinformer.ProcessTrigger, bool) {
	w.triggersMu.Lock()
	defer w.triggersMu.Unlock()
	trigger, ok := w.triggers[key]
	if ok {
		delete(w.triggers, key)
	}
	return trigger, ok
}

// Run starts workerCount workers and blocks until ctx is done, then drains the
// queue for at most the drain timeout. onStarted is called once the workers are
// launched, and onShutdown as soon as ctx is done, before draining.
func (w *Workers) Run(ctx context.Context, workerCount int, onStarted func(), onShutdown func()) {
	defer utilruntime.HandleCrash()
	defer w.queue.ShutDown()

	logger := w.cfg.Logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting " + w.cfg.Controller)
	defer logger.Info("Shutting down " + w.cfg.Controller)

	logger.Info("Starting workers", "count", workerCount)
	for i := range workerCount {
		workerCtx := logging.Context(ctx, logger.With("worker_id", i))
		go wait.UntilWithContext(workerCtx, w.runWorker, time.Second)
	}

	logger.Info("Started workers")
	onStarted()

	<-ctx.Done()
	onShutdown()
	logger.Info("Shutting down workers, draining queue")

	drainDone := make(chan struct{})
	go func() {
		w.queue.ShutDownWithDrain()
		close(drainDone)
	}()

	select {
	case <-drainDone:
		logger.Info("Queue drained successfully")
	case <-time.After(w.cfg.DrainTimeout):
		logger.Warn("Drain timeout exceeded, forcing shutdown")
		w.queue.ShutDown()
	}
}

func (w *Workers) runWorker(ctx context.Context) {
	for w.ProcessNextWorkItem(ctx) {
	}
}

// ProcessNextWorkItem processes one key off the queue. It returns false when
// the queue has shut down.
func (w *Workers) ProcessNextWorkItem(ctx context.Context) bool {
	key, quit := w.queue.Get()
	if quit {
		return false
	}
	defer w.queue.Done(key)
	// Safety net: clear inflight even if the reconcile panics.
	defer w.lag.done(key)

	namespace, name, _ := cache.SplitMetaNamespaceKey(key)
	// queue_len is the backlog still waiting after this pickup (Get removed the
	// current key), so a growing queue is visible per reconcile in the logs.
	logger := logging.FromContext(ctx).With("work_key", key, "namespace", namespace, w.cfg.Kind, name, "queue_len", w.queue.Len())
	if enqueuedAt, ok := w.lag.get(key); ok {
		logger = logger.With("queue_wait", time.Since(enqueuedAt))
	}
	logger.Info(w.cfg.Controller + " processing key")

	trigger, ok := w.popTrigger(key)
	// NumRequeues counts prior AddRateLimited calls; add 1 for the current attempt.
	attempts := w.queue.NumRequeues(key) + 1
	// Count the start of processing once per informer delivery. A missing entry
	// is an internal reschedule with no informer event behind it, and retries
	// keep the entry but bump NumRequeues, so neither is counted again.
	if ok && attempts == 1 {
		w.cfg.Processed.RecordProcessed(trigger)
	}

	start := time.Now()
	fields, err := w.process(ctx, key)
	logger = logger.With(fields...).With("duration", time.Since(start))
	// Count every reconcile execution, retries included, by outcome, so this
	// counter is the denominator for the reconcile error rate.
	w.cfg.Processed.RecordReconcile(err)
	if err == nil {
		// Drop from inflight before reading lag so queue_lag reflects the
		// remaining backlog, not the key just completed.
		w.lag.done(key)
		w.queue.Forget(key)
		logger.With("queue_lag", w.lag.lag()).Info(w.cfg.Controller + " finished processing key")
		return true
	}

	logger = logger.With("queue_lag", w.lag.lag(), "error", err, "attempts", attempts)
	logger.Error(w.cfg.Controller + " failed to process key")
	w.lag.done(key)

	if attempts >= w.cfg.MaxAttempts {
		logger.Error(w.cfg.Controller + " failed too many times")
		w.queue.Forget(key)
		return true
	}

	if !w.cfg.Retryable(err) {
		logger.Info(w.cfg.Controller + " will not retry")
		w.queue.Forget(key)
		return true
	}

	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", key, err))
	// Re-set the attribution the pickup popped so the retry keeps it, unless a
	// concurrent enqueue set a newer one. An internal reschedule carries no
	// attribution and must not fabricate one.
	if ok {
		w.setTrigger(key, trigger)
	}
	w.queue.AddRateLimited(key)
	logger.Info(w.cfg.Controller+" will retry as the failure is transient", "queue_len", w.queue.Len())
	return true
}
