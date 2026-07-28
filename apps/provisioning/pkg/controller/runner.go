package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
)

// defaultMaxAttempts bounds how many times a key is processed after retriable
// errors before it is dropped from the queue.
const defaultMaxAttempts = 3

// RunnerConfig configures a Runner.
type RunnerConfig struct {
	// Name identifies the runner; it is used as the work queue name and as the
	// default logger name.
	Name string

	// Process reconciles one namespace/name key. It receives the Run context,
	// which is canceled when shutdown begins; in-flight keys are still drained
	// after cancellation, so a Process that must complete its reconcile during
	// the drain has to decouple its own context from the one passed in.
	Process func(ctx context.Context, key string) error

	// DrainTimeout bounds how long Run waits for in-flight keys after shutdown
	// before forcing the queue closed.
	DrainTimeout time.Duration

	// Logger is used for the run loop and worker logs. Defaults to the default
	// logger named after Name.
	Logger logging.Logger

	// MaxAttempts bounds how many times a key is processed after retriable
	// errors before it is dropped. Defaults to defaultMaxAttempts.
	MaxAttempts int

	// Retriable decides whether a Process error is worth re-queuing the key
	// with rate-limited backoff. Defaults to apierrors.IsServiceUnavailable.
	Retriable func(error) bool
}

// Runner is the shared reconcile loop for provisioning controllers: a
// rate-limited work queue of namespace/name keys drained by a pool of worker
// goroutines. The queue deduplicates keys and never hands the same key to two
// workers at once, so reconciles for a given object are serialized within a
// replica; the worker count only sets how many distinct objects are reconciled
// in parallel.
type Runner struct {
	name         string
	logger       logging.Logger
	process      func(ctx context.Context, key string) error
	queue        workqueue.TypedRateLimitingInterface[string]
	maxAttempts  int
	retriable    func(error) bool
	drainTimeout time.Duration
}

// NewRunner creates a Runner from the given config, applying defaults for the
// optional fields.
func NewRunner(cfg RunnerConfig) *Runner {
	logger := cfg.Logger
	if logger == nil {
		logger = logging.DefaultLogger.With("logger", cfg.Name)
	}
	maxAttempts := cfg.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = defaultMaxAttempts
	}
	retriable := cfg.Retriable
	if retriable == nil {
		retriable = apierrors.IsServiceUnavailable
	}

	return &Runner{
		name:    cfg.Name,
		logger:  logger,
		process: cfg.Process,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{
				Name: cfg.Name,
			},
		),
		maxAttempts:  maxAttempts,
		retriable:    retriable,
		drainTimeout: cfg.DrainTimeout,
	}
}

// Enqueue adds a namespace/name key to the work queue. Keys already queued or
// in flight are deduplicated: a key added while it is being processed is
// re-queued once its current round finishes.
func (r *Runner) Enqueue(key string) {
	r.queue.Add(key)
}

// EnqueueAfter adds a key to the work queue after the given delay.
func (r *Runner) EnqueueAfter(key string, delay time.Duration) {
	r.queue.AddAfter(key, delay)
}

// Run starts workerCount workers and blocks until the context is canceled and
// the queue has been drained (bounded by DrainTimeout).
//
// The onStarted callback is invoked once all workers have been launched.
// The onShutdown callback is invoked immediately when context cancellation is
// detected, before draining in-flight work.
//
// Note: This function intentionally does NOT create a tracing span because it
// runs indefinitely until shutdown. Individual processing operations already
// have their own spans.
func (r *Runner) Run(ctx context.Context, workerCount int, onStarted func(), onShutdown func()) {
	defer utilruntime.HandleCrash()
	defer r.queue.ShutDown()

	logger := r.logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting controller")
	defer logger.Info("Shutting down controller")

	logger.Info("Starting workers", "count", workerCount)
	for i := range workerCount {
		workerCtx := logging.Context(ctx, logger.With("worker_id", i))
		go wait.UntilWithContext(workerCtx, r.runWorker, time.Second)
	}

	logger.Info("Started workers")
	onStarted()

	<-ctx.Done()
	onShutdown()
	logger.Info("Shutting down workers, draining queue")

	drainDone := make(chan struct{})
	go func() {
		r.queue.ShutDownWithDrain()
		close(drainDone)
	}()

	select {
	case <-drainDone:
		logger.Info("Queue drained successfully")
	case <-time.After(r.drainTimeout):
		logger.Warn("Drain timeout exceeded, forcing shutdown")
		r.queue.ShutDown()
	}
}

func (r *Runner) runWorker(ctx context.Context) {
	for r.processNextWorkItem(ctx) {
	}
}

// processNextWorkItem deals with one key off the queue.
// It returns false when it's time to quit.
func (r *Runner) processNextWorkItem(ctx context.Context) bool {
	key, quit := r.queue.Get()
	if quit {
		return false
	}
	defer r.queue.Done(key)

	namespace, name, _ := cache.SplitMetaNamespaceKey(key)
	logger := logging.FromContext(ctx).With("work_key", key, "namespace", namespace, "name", name)
	logger.Info("processing key")

	err := r.process(ctx, key)
	if err == nil {
		r.queue.Forget(key)
		return true
	}

	// NumRequeues counts prior AddRateLimited calls; add 1 for the current attempt.
	attempts := r.queue.NumRequeues(key) + 1
	logger = logger.With("error", err, "attempts", attempts)
	logger.Error("failed to process key")

	if attempts >= r.maxAttempts {
		logger.Error("failed too many times, dropping key")
		r.queue.Forget(key)
		return true
	}

	if !r.retriable(err) {
		logger.Info("error is not retriable, dropping key")
		r.queue.Forget(key)
		return true
	}

	logger.Info("retrying key")
	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", key, err))
	r.queue.AddRateLimited(key)

	return true
}
