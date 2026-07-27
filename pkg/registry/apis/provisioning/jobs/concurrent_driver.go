package jobs

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	// maxClaimAttempts bounds how many times a job key is retried after transient
	// errors before it is dropped from the queue. The backstop poll re-adds the
	// key if the job is still unclaimed.
	maxClaimAttempts = 3

	// minBackstopListLimit and maxBackstopListLimit bound the page size of the
	// periodic unclaimed-jobs list. The floor keeps small worker pools from
	// starving a backlog; the cap keeps a single page cheap. A truncated page
	// self-corrects: claims shrink the unclaimed set and the next poll picks up
	// the remainder.
	minBackstopListLimit = 16
	maxBackstopListLimit = 1000
)

// ConcurrentJobDriver processes provisioning jobs with a pool of worker
// goroutines fed by a single per-replica work queue of job keys. Keys enter
// the queue from informer create events (EventHandler) and from a periodic
// backstop list of unclaimed jobs, so idle API-server load is one list per
// jobInterval regardless of the number of workers. Workers claim the specific
// job behind a key; the claim label remains the cross-replica mutual exclusion.
type ConcurrentJobDriver struct {
	numDrivers           int
	jobTimeout           time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	store                Store
	repoGetter           RepoGetter
	historicJobs         HistoryWriter
	workers              []Worker
	metrics              *JobMetrics
	queue                workqueue.TypedRateLimitingInterface[string]

	// logger is used by informer event callbacks, which run outside Run's
	// context and therefore cannot use logging.FromContext.
	logger logging.Logger
}

// NewConcurrentJobDriver creates a new concurrent job driver that spawns multiple job workers.
func NewConcurrentJobDriver(
	numDrivers int,
	jobTimeout, jobInterval, leaseRenewalInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs HistoryWriter,
	registry prometheus.Registerer,
	metrics *JobMetrics,
	workers ...Worker,
) (*ConcurrentJobDriver, error) {
	if numDrivers <= 0 {
		return nil, fmt.Errorf("numDrivers must be greater than 0, got %d", numDrivers)
	}
	// Default lease renewal interval to 1/3 of job timeout, minimum 5 seconds
	if leaseRenewalInterval <= 0 {
		leaseRenewalInterval = jobTimeout / 3
	}
	if leaseRenewalInterval < 5*time.Second {
		leaseRenewalInterval = 5 * time.Second
	}

	recordConcurrentDriverMetric(registry, numDrivers)

	return &ConcurrentJobDriver{
		numDrivers:           numDrivers,
		jobTimeout:           jobTimeout,
		jobInterval:          jobInterval,
		leaseRenewalInterval: leaseRenewalInterval,
		store:                store,
		repoGetter:           repoGetter,
		historicJobs:         historicJobs,
		workers:              workers,
		metrics:              metrics,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{
				Name: "provisioningJobDriver",
			},
		),
		logger: logging.DefaultLogger.With("logger", "concurrent-job-driver"),
	}, nil
}

// EventHandler returns informer event handlers that feed the work queue.
// Register it with the jobs informer before the informer runs: the NATS-backed
// source has no cache to replay for late handlers.
//
// Only create events enqueue. Updates are claim/lease/progress churn from
// running jobs, and jobs that return to the unclaimed state (a rolled-back
// claim) are recovered by the backstop poll instead.
func (c *ConcurrentJobDriver) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			// Skip jobs that are already claimed when label data is present (the
			// apiserver informer and periodic re-lists deliver full objects). NATS
			// live events carry only namespace/name and always enqueue; the
			// worker's claim then cheaply skips anything already taken.
			if job, ok := obj.(*provisioning.Job); ok && job.Labels[LabelJobClaim] != "" {
				c.logger.Debug("skip create event for already-claimed job",
					"namespace", job.GetNamespace(), "job", job.GetName())
				return
			}
			key, err := cache.MetaNamespaceKeyFunc(obj)
			if err != nil {
				c.logger.Error("could not build key for job create event", "error", err)
				return
			}
			c.queue.Add(key)
			c.logger.Debug("job create event enqueued", "work_key", key, "queue_len", c.queue.Len())
		},
	}
}

// Run starts the backstop poller and the worker pool.
// This is a blocking function that will run until the context is canceled.
//
// Note: This function intentionally does NOT create a tracing span because it runs indefinitely
// until shutdown. Individual job processing operations already have their own spans.
func (c *ConcurrentJobDriver) Run(ctx context.Context) error {
	logger := logging.FromContext(ctx).With("logger", "concurrent-job-driver", "num_drivers", c.numDrivers)
	ctx = logging.Context(ctx, logger)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*") // "*" grants us access to all namespaces.
	if err != nil {
		return apifmt.Errorf("failed to grant provisioning identity: %w", err)
	}

	logger.Info("start concurrent job driver",
		"job_timeout", c.jobTimeout,
		"backstop_poll_interval", c.jobInterval,
		"lease_renewal_interval", c.leaseRenewalInterval,
	)

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		c.runBackstopPoller(ctx)
	}()

	for i := 0; i < c.numDrivers; i++ {
		wg.Add(1)
		go func(driverID int) {
			defer wg.Done()

			driverLogger := logger.With("logger", "job-driver", "driver_id", driverID)
			driverCtx := logging.Context(ctx, driverLogger)

			// One processor per worker goroutine: its in-flight job state must
			// never be shared across goroutines.
			processor := newJobProcessor(
				c.jobTimeout,
				c.leaseRenewalInterval,
				c.store,
				c.repoGetter,
				c.historicJobs,
				c.metrics,
				c.workers...,
			)

			driverLogger.Debug("start job driver")
			for c.processNextWorkItem(driverCtx, processor) {
			}
			driverLogger.Debug("job driver stopped")
		}(i)
	}

	<-ctx.Done()
	logger.Info("shutting down job drivers", "queued_jobs", c.queue.Len())
	// ShutDown rather than ShutDownWithDrain: each queued key is a full job run,
	// and unclaimed jobs persist in storage — a live replica's backstop re-adds them.
	c.queue.ShutDown()
	wg.Wait()
	logger.Info("all job drivers gracefully stopped")
	return nil
}

// processNextWorkItem takes one job key from the queue and processes it.
// It returns false when the queue is shutting down.
func (c *ConcurrentJobDriver) processNextWorkItem(ctx context.Context, processor *jobProcessor) bool {
	key, shutdown := c.queue.Get()
	if shutdown {
		return false
	}
	defer c.queue.Done(key)

	logger := logging.FromContext(ctx).With("work_key", key)

	// After shutdown begins, Get keeps returning queued keys until the queue is
	// empty; skip them so workers exit promptly instead of claiming jobs mid-shutdown.
	if ctx.Err() != nil {
		logger.Debug("discard queued job during shutdown")
		c.queue.Forget(key)
		return true
	}

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		logger.Error("invalid job key - dropping", "error", err)
		c.queue.Forget(key)
		return true
	}

	logger.Debug("process job key", "attempt", c.queue.NumRequeues(key)+1)

	err = processor.processKey(ctx, namespace, name)
	switch {
	case err == nil:
		c.queue.Forget(key)
	case errors.Is(err, ErrAlreadyClaimed):
		logger.Debug("job already claimed by another worker - dropping from queue")
		c.queue.Forget(key)
	case apierrors.IsNotFound(err):
		logger.Debug("job no longer exists - dropping from queue")
		c.queue.Forget(key)
	case c.queue.NumRequeues(key)+1 >= maxClaimAttempts:
		logger.Error("job failed too many times - dropping from queue; the backstop poll re-adds it if still unclaimed",
			"attempts", c.queue.NumRequeues(key)+1, "error", err)
		c.queue.Forget(key)
	default:
		logger.Warn("failed to process job - will retry",
			"attempt", c.queue.NumRequeues(key)+1, "error", err)
		c.queue.AddRateLimited(key)
	}
	return true
}

// runBackstopPoller periodically feeds unclaimed jobs into the work queue.
// It is the recovery path for anything the informer events miss: rolled-back
// claims, keys dropped after retry exhaustion, lost notifications, and the
// backlog present at startup.
func (c *ConcurrentJobDriver) runBackstopPoller(ctx context.Context) {
	logger := logging.FromContext(ctx).With("logger", "job-backstop-poller")
	ctx = logging.Context(ctx, logger)

	limit := c.numDrivers
	if limit < minBackstopListLimit {
		limit = minBackstopListLimit
	}
	if limit > maxBackstopListLimit {
		limit = maxBackstopListLimit
	}

	logger.Debug("start backstop poller", "interval", c.jobInterval, "list_limit", limit)

	// Enqueue the startup backlog without waiting for the first tick.
	c.enqueueUnclaimedJobs(ctx, limit)

	ticker := time.NewTicker(c.jobInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Debug("backstop poller stopped")
			return
		case <-ticker.C:
			c.enqueueUnclaimedJobs(ctx, limit)
		}
	}
}

func (c *ConcurrentJobDriver) enqueueUnclaimedJobs(ctx context.Context, limit int) {
	logger := logging.FromContext(ctx)

	unclaimed, err := c.store.ListUnclaimedJobs(ctx, limit)
	if err != nil {
		logger.Error("failed to list unclaimed jobs", "error", err)
		return
	}

	for _, job := range unclaimed {
		key, err := cache.MetaNamespaceKeyFunc(job)
		if err != nil {
			logger.Error("could not build key for job", "namespace", job.GetNamespace(), "job", job.GetName(), "error", err)
			continue
		}
		// The queue deduplicates keys that are already queued or in flight.
		c.queue.Add(key)
	}

	// Unclaimed jobs here are normal right after creation bursts (the poll races
	// the informer event; the queue deduplicates), but a steady stream at an idle
	// time means events are being missed and the backstop is doing the rescuing.
	if len(unclaimed) > 0 {
		logger.Info("backstop poll enqueued unclaimed jobs", "found", len(unclaimed), "queue_len", c.queue.Len())
	} else {
		logger.Debug("backstop poll found no unclaimed jobs")
	}
}
