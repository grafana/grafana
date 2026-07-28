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

// maxClaimAttempts bounds how many times a job key is retried after transient
// errors before it is dropped from the queue. The informer's periodic
// resync/re-list re-delivers the key if the job is still unclaimed.
const maxClaimAttempts = 3

// defaultPostClaimCooldown is the post-claim cooldown used when the constructor
// is given a non-positive resync interval. It matches the default resync
// cadence of both wirings.
const defaultPostClaimCooldown = 30 * time.Second

// ConcurrentJobDriver processes provisioning jobs with a pool of worker
// goroutines fed by a single per-replica work queue of job keys. Keys enter
// the queue exclusively from the jobs informer (EventHandler): live create
// events, plus the informer's periodic resync/re-list, which re-delivers
// unclaimed jobs as updates and is the recovery path for rolled-back claims,
// dropped keys, and missed notifications. Workers claim the specific job
// behind a key; the claim label remains the cross-replica mutual exclusion.
type ConcurrentJobDriver struct {
	numDrivers           int
	jobTimeout           time.Duration
	leaseRenewalInterval time.Duration
	store                Store
	repoGetter           RepoGetter
	historicJobs         HistoryWriter
	workers              []Worker
	metrics              *JobMetrics
	queue                workqueue.TypedRateLimitingInterface[string]

	// postClaimCooldown is how long a key is barred from processing after its
	// job failed post-claim: the side effects may already have run, and the
	// rolled-back claim makes the job immediately claimable again. The bar is
	// enforced at dequeue time because enqueue-side filtering cannot cover every
	// path back into the queue — a resync that snapshots the job before the
	// worker's claim lands adds the in-flight key, the queue marks it dirty, and
	// redelivers it the moment Done runs. It equals the jobs informer's resync
	// interval, so recovery of a failed run keeps the configured pickup cadence:
	// the first resync after the cooldown passes re-adds the key.
	postClaimCooldown time.Duration

	// mu guards cooldowns. cooldowns maps a job key to the time its post-claim
	// cooldown expires; workers refuse to process a key before then.
	mu        sync.Mutex
	cooldowns map[string]time.Time

	// logger is used by informer event callbacks, which run outside Run's
	// context and therefore cannot use logging.FromContext.
	logger logging.Logger
}

// NewConcurrentJobDriver creates a new concurrent job driver that spawns
// multiple job workers. resyncInterval is the jobs informer's resync/re-list
// cadence; the driver uses it as the post-claim cooldown so failed-run recovery
// tracks the configured pickup interval (non-positive falls back to 30s).
func NewConcurrentJobDriver(
	numDrivers int,
	jobTimeout, resyncInterval, leaseRenewalInterval time.Duration,
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
	if resyncInterval <= 0 {
		resyncInterval = defaultPostClaimCooldown
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
		leaseRenewalInterval: leaseRenewalInterval,
		postClaimCooldown:    resyncInterval,
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
		cooldowns: make(map[string]time.Time),
		logger:    logging.DefaultLogger.With("logger", "concurrent-job-driver"),
	}, nil
}

// HasCapacity reports whether the work queue has room for more discovered jobs.
// It returns false once at least numDrivers keys are already queued: every worker
// then has work waiting, so discovering more only grows the backlog and memory
// without improving throughput. The jobs informer consults it to stop paginating
// its re-list under backpressure (see NewJobInformer); a page holds up to 500
// jobs, far more than numDrivers, so under load the re-list settles at one page
// per resync. queue.Len counts only queued (not in-flight) keys, so a full page
// keeps the queue above the threshold until the workers drain it.
func (c *ConcurrentJobDriver) HasCapacity() bool {
	return c.queue.Len() < c.numDrivers
}

// EventHandler returns informer event handlers that feed the work queue.
// Register it with the jobs informer before the informer runs: the NATS-backed
// source has no cache to replay for late handlers.
//
// Create events enqueue new jobs; the informer's periodic resync/re-list
// re-delivers every known job as an update, and unclaimed ones re-enter the
// queue there. That resync path is the driver's only recovery mechanism — for
// rolled-back claims, keys dropped after retry exhaustion, missed NATS
// notifications, and the backlog present at startup (the initial list) — so
// the informer must be wired and running for jobs to be processed.
func (c *ConcurrentJobDriver) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			job, ok := obj.(*provisioning.Job)
			if !ok {
				c.logger.Error("unexpected object type in job create event", "type", fmt.Sprintf("%T", obj))
				return
			}
			// Skip jobs that are already claimed when label data is present (the
			// apiserver informer and periodic re-lists deliver full objects). NATS
			// live events carry only namespace/name and always enqueue; the
			// worker's claim then cheaply skips anything already taken.
			if job.Labels[LabelJobClaim] != "" {
				c.logger.Debug("skip create event for already-claimed job",
					"namespace", job.GetNamespace(), "job", job.GetName())
				return
			}
			c.enqueueCreate(job)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			job, ok := newObj.(*provisioning.Job)
			if !ok {
				c.logger.Error("unexpected object type in job update event", "type", fmt.Sprintf("%T", newObj))
				return
			}
			// A minimal live event (NATS: namespace+name only, no resource version)
			// is claim/lease/progress churn from a running job; enqueuing each one
			// would cost a wasted claim attempt per write. Jobs that return to the
			// unclaimed state are re-delivered as full objects on the next re-list.
			// Deliberately not logged: one write per lease renewal and progress
			// update makes this the hottest path through the handler.
			if job.ResourceVersion == "" {
				return
			}
			// Claimed jobs are running-job churn; also not logged (one per running
			// job per resync).
			if job.Labels[LabelJobClaim] != "" {
				return
			}
			// Only resync/re-list redeliveries enqueue. They are recognizable
			// because both wirings hand the handler the same stored object as old
			// and new (identical resource versions), while a live watch update
			// always carries a bumped one. A live update that removes the claim —
			// a rollback after a post-claim failure — must NOT enqueue: the job's
			// side effects may already have run, and because the rollback lands
			// while the key is still in flight, the queue would redeliver it the
			// moment the worker calls Done, re-running the job immediately and
			// without backoff. The next resync re-delivers it at the recovery
			// cadence instead.
			if oldJob, ok := oldObj.(*provisioning.Job); ok && oldJob.ResourceVersion != job.ResourceVersion {
				return
			}
			c.enqueueRecovered(job)
		},
	}
}

// enqueueCreate adds a freshly-created job's key to the work queue. This is the
// hot path for every job, so it logs at debug.
func (c *ConcurrentJobDriver) enqueueCreate(job *provisioning.Job) {
	key, err := cache.MetaNamespaceKeyFunc(job)
	if err != nil {
		c.logger.Error("could not build key for job create event",
			"namespace", job.GetNamespace(), "job", job.GetName(), "error", err)
		return
	}
	// Job names are deterministic, so a new job may reuse the key of a
	// predecessor that failed post-claim. A create event announces a new
	// incarnation, which must not sit out its predecessor's cooldown.
	c.clearCooldown(key)
	// The queue deduplicates keys that are already queued or in flight.
	c.queue.Add(key)
	c.logger.Debug("job create event enqueued", "work_key", key, "queue_len", c.queue.Len())
}

// enqueueRecovered adds an unclaimed job delivered by a resync/re-list update.
// This is the recovery path at work — the job's create event was missed, its
// claim was rolled back, or its key was dropped after retry exhaustion — so it
// logs at info with the job's age. Redeliveries right after a creation burst
// (the resync races the create event) are normal and deduplicated by the queue,
// but a steady stream of *old* jobs here means live events are being missed and
// the resync is doing the rescuing.
func (c *ConcurrentJobDriver) enqueueRecovered(job *provisioning.Job) {
	key, err := cache.MetaNamespaceKeyFunc(job)
	if err != nil {
		c.logger.Error("could not build key for job update event",
			"namespace", job.GetNamespace(), "job", job.GetName(), "error", err)
		return
	}
	// The queue deduplicates keys that are already queued or in flight.
	c.queue.Add(key)
	c.logger.Info("resync enqueued unclaimed job",
		"work_key", key,
		"job_age", time.Since(job.CreationTimestamp.Time).Round(time.Second),
		"job_state", job.Status.State,
		"queue_len", c.queue.Len())
}

// startCooldown bars key from processing for postClaimCooldown. Expired entries
// are swept on each insert so keys whose jobs never return (e.g. completed by
// another worker) do not accumulate; inserts only happen on the rare post-claim
// failure path, so the sweep is cheap.
func (c *ConcurrentJobDriver) startCooldown(key string) {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, until := range c.cooldowns {
		if now.After(until) {
			delete(c.cooldowns, k)
		}
	}
	c.cooldowns[key] = now.Add(c.postClaimCooldown)
}

// inCooldown reports whether key is still within its post-claim cooldown,
// pruning the entry once it has expired.
func (c *ConcurrentJobDriver) inCooldown(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	until, ok := c.cooldowns[key]
	if !ok {
		return false
	}
	if time.Now().After(until) {
		delete(c.cooldowns, key)
		return false
	}
	return true
}

func (c *ConcurrentJobDriver) clearCooldown(key string) {
	c.mu.Lock()
	delete(c.cooldowns, key)
	c.mu.Unlock()
}

// Run starts the worker pool.
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
		"lease_renewal_interval", c.leaseRenewalInterval,
	)

	var wg sync.WaitGroup

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
	// and unclaimed jobs persist in storage — a live replica's informer re-list
	// re-adds them.
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

	// A key in post-claim cooldown must not be processed regardless of how it
	// re-entered the queue — most importantly the dirty-key redelivery from a
	// resync that raced the failed run's claim, which arrives the moment that
	// run calls Done. A later resync re-adds the key once the cooldown passes.
	if c.inCooldown(key) {
		logger.Debug("job key in post-claim cooldown - dropping; a later resync re-adds it")
		c.queue.Forget(key)
		return true
	}

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		logger.Error("invalid job key - dropping", "error", err)
		c.queue.Forget(key)
		return true
	}

	attempt := c.queue.NumRequeues(key) + 1
	logger.Debug("process job key", "attempt", attempt)

	err = processor.processKey(ctx, namespace, name)
	switch {
	case err == nil:
		if attempt > 1 {
			logger.Info("job claim succeeded after retries", "attempts", attempt)
		}
		c.queue.Forget(key)
	case errors.Is(err, ErrAlreadyClaimed):
		logger.Debug("job already claimed by another worker - dropping from queue")
		c.queue.Forget(key)
	case apierrors.IsNotFound(err):
		logger.Debug("job no longer exists - dropping from queue")
		c.queue.Forget(key)
	case errors.Is(err, errPostClaim):
		// The job may already have executed; an immediate retry would re-run its
		// side effects. Its claim was rolled back, so the informer re-list
		// re-discovers it at the resync cadence instead. The cooldown makes that
		// stick: a resync that raced this run's claim may already have marked the
		// in-flight key dirty, and the queue redelivers it as soon as we return.
		c.startCooldown(key)
		logger.Error("job failed after it was claimed - dropping from queue; the informer re-list re-adds it after a cooldown",
			"attempt", attempt, "cooldown", c.postClaimCooldown, "error", err)
		c.queue.Forget(key)
	case attempt >= maxClaimAttempts:
		logger.Error("job failed too many times - dropping from queue; the informer re-list re-adds it if still unclaimed",
			"attempts", attempt, "error", err)
		c.queue.Forget(key)
	default:
		// Only claim-path failures reach here; the job was never claimed by this
		// worker, so retrying cannot re-run any work.
		logger.Warn("failed to claim job - will retry",
			"attempt", attempt, "max_attempts", maxClaimAttempts, "error", err)
		c.queue.AddRateLimited(key)
	}
	return true
}
