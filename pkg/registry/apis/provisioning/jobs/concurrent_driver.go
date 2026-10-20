package jobs

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// queuedEvent is what the driver remembers about a queued key between enqueue
// and pickup: what delivered it, and when it joined the work queue (for the
// delivery-latency measurement).
type queuedEvent struct {
	trigger  claimTrigger
	enqueued time.Time
}

// maxClaimAttempts bounds how many times a job key is retried after transient
// errors before it is dropped from the queue. The informer's periodic
// resync/re-list re-delivers the key if the job is still unclaimed.
const maxClaimAttempts = 3

// maxStaleClaimAttempts bounds the retries of a claim outcome the freshness
// floor rejected as a lagging read. The count is really a wall-clock budget:
// the queue's per-item limiter doubles from 5ms, so the nine waits between ten
// attempts sum to ~2.6s — nearly all of it in the last three — matching the
// ~2.3s the repository/connection getters afford (4 in-place reads × 250ms ×
// 3 workqueue attempts). Each attempt is one cheap GET; a worker never sleeps
// in place, which is why the budget must come from the backoff schedule
// rather than fewer, longer waits. Past it, the key drops and the re-list (or
// the floor's TTL) resolves the disagreement; stale_reads_exhausted_total is
// the signal that this budget is too tight in practice.
const maxStaleClaimAttempts = 10

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

	// processed classifies each delivery and records the processing metrics. It
	// encapsulates the delivery backend (natsBacked) and the resource label, so
	// the driver passes only raw event facts.
	processed *usinformer.ProcessedMetrics

	// staleReads counts claim outcomes the freshness floor rejected as lagging
	// reads (retried) and the keys surrendered to the re-list after the retries
	// ran out (exhausted).
	staleReads *usinformer.StaleReadMetrics

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

	// mu guards cooldowns and triggers. cooldowns maps a job key to the time its
	// post-claim cooldown expires; workers refuse to process a key before then.
	// triggers maps a queued key to how it was enqueued — what delivered it and
	// when it joined the queue — so processing can be attributed and its delivery
	// latency measured. Entries live only between enqueue and pickup.
	mu        sync.Mutex
	cooldowns map[string]time.Time
	triggers  map[string]queuedEvent

	// floor, when set, is the freshness floor the NATS jobs informer maintains
	// (see TrackFloor). The driver consults it only to disambiguate a claim 404:
	// a floor outstanding for the key means the job was announced and the read
	// path has not caught up, so the claim is retried instead of trusting the
	// NotFound as "completed and deleted".
	floor *usinformer.RVFloor

	// logger is used by informer event callbacks, which run outside Run's
	// context and therefore cannot use logging.FromContext.
	logger logging.Logger
}

// TrackFloor gives the driver the freshness floor its informer maintains, so
// claim reads can be validated against what was announced. Call before Run; a
// nil floor (the apiserver wiring) leaves every claim outcome trusted.
func (c *ConcurrentJobDriver) TrackFloor(floor *usinformer.RVFloor) { c.floor = floor }

// staleClaimRead reports whether a claim failure is evidence of a lagging read
// path rather than the job's true state: a 404 while a live floor says the job
// was announced (under a deletion watermark the 404 IS the truth — the job
// completed and was deleted), or an "already claimed" observed at a version
// below the floor — the still-claimed predecessor of a reused name, not the
// announced incarnation. An AlreadyClaimedError at or above the floor is
// genuine contention.
func (c *ConcurrentJobDriver) staleClaimRead(err error, namespace, name string) bool {
	if c.floor == nil {
		return false
	}
	if apierrors.IsNotFound(err) {
		rv, deleted := c.floor.Watermark(namespace, name)
		return rv > 0 && !deleted
	}
	var claimed *AlreadyClaimedError
	if errors.As(err, &claimed) {
		return c.floor.Below(namespace, name, claimed.ObservedResourceVersion)
	}
	return false
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
	natsBacked bool,
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

	driver := &ConcurrentJobDriver{
		numDrivers:           numDrivers,
		jobTimeout:           jobTimeout,
		leaseRenewalInterval: leaseRenewalInterval,
		postClaimCooldown:    resyncInterval,
		store:                store,
		repoGetter:           repoGetter,
		historicJobs:         historicJobs,
		workers:              workers,
		metrics:              metrics,
		processed:            usinformer.NewProcessedMetrics(registry, resourceLabelJobs, natsBacked),
		staleReads:           usinformer.NewStaleReadMetrics(registry, resourceLabelJobs),
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{
				Name: "provisioningJobDriver",
			},
		),
		cooldowns: make(map[string]time.Time),
		triggers:  make(map[string]queuedEvent),
		logger:    logging.DefaultLogger.With("logger", "concurrent-job-driver"),
	}

	// Expose the local work-queue depth as a scrape-time gauge. The queue is
	// per-replica, so Prometheus target labels (pod/instance) distinguish replicas;
	// no metric label is needed. A GaugeFunc reads the authoritative Len() at scrape
	// time, so it cannot drift the way manual inc/dec would.
	registry.MustRegister(prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_worker_queue_size",
			Help: "Number of job keys waiting in this replica's local work queue",
		},
		func() float64 { return float64(driver.queue.Len()) },
	))

	return driver, nil
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
func (c *ConcurrentJobDriver) EventHandler() cache.ResourceEventHandlerDetailedFuncs {
	return cache.ResourceEventHandlerDetailedFuncs{
		AddFunc: func(obj interface{}, isInInitialList bool) {
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
			// Attribute the enqueue for the processing-level metrics.
			c.enqueueCreate(job, c.processed.ClassifyAdd(job.ResourceVersion, isInInitialList))
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
// hot path for every job, so it logs at debug. trigger records what delivered
// the key for the processing-level metrics.
func (c *ConcurrentJobDriver) enqueueCreate(job *provisioning.Job, trigger claimTrigger) {
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
	// Attribute the key before the enqueue so a worker that dequeues immediately
	// sees it.
	c.setQueued(key, trigger, time.Now())
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
	// A resync/re-list redelivery is always relist-attributed. Set only if
	// absent so a queued live enqueue is never downgraded.
	c.setQueued(key, triggerRelist, time.Now())
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

// setQueued records how key was enqueued, first-wins: the enqueue that first
// queued the key owns the attribution and the enqueue time, and later
// deliveries that coalesce onto the still-queued key (or a retry re-set) leave
// it alone. First-wins is what the metric wants — the source that actually
// caused the pickup. In particular, if a re-list recovers a job before its
// late live event arrives, the pickup stays attributed to relist (the
// missed/late-live signal), not overwritten to live. A genuinely new job
// incarnation reusing a deterministic name does not collide here: the
// predecessor's entry is popped when it is picked up, so the new incarnation's
// live enqueue finds the key absent and is recorded as live. The map entry lives
// only between enqueue and pickup.
func (c *ConcurrentJobDriver) setQueued(key string, trigger claimTrigger, enqueued time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.triggers[key]; !ok {
		c.triggers[key] = queuedEvent{trigger: trigger, enqueued: enqueued}
	}
}

// popQueued reads and removes key's entry. Each pickup pops its own entry up
// front, so the entry never outlives the key however the pickup ends, and a
// concurrent enqueue that races an in-flight key (setting a fresh entry and
// marking the key dirty) keeps its attribution for the redelivery — a terminal
// queue.Forget must not clobber it. A retry re-sets the popped entry before
// re-queuing so later attempts keep the original attribution and enqueue time.
func (c *ConcurrentJobDriver) popQueued(key string) (queuedEvent, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	qe, ok := c.triggers[key]
	if ok {
		delete(c.triggers, key)
	}
	return qe, ok
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
				strconv.Itoa(driverID),
				c.metrics,
				c.processed,
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

	// Pop this pickup's entry up front so it is cleared however the key leaves
	// this function, without a terminal Forget clobbering a newer entry set by a
	// concurrent enqueue while the key was in flight. A missing entry (only
	// reachable via a dirty redelivery after a Forget) falls back to relist so
	// live+relist+initial always sums to total processed.
	queued, ok := c.popQueued(key)
	if !ok {
		queued.trigger = triggerRelist
	}
	trigger := queued.trigger

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

	err = processor.processKey(ctx, namespace, name, trigger, queued.enqueued)
	// A claim outcome read below the announced floor is a lagging replica, not
	// truth: a 404 may hide an announced create, and an "already claimed" may be
	// the still-claimed predecessor of a reused job name whose fresh incarnation
	// this replica cannot see yet. Both retry on the claim path (nothing ran, so
	// retrying cannot re-run any work), under a larger attempt cap so the
	// backoff can outlast the visibility lag.
	staleClaimRead := c.staleClaimRead(err, namespace, name)
	switch {
	case err == nil:
		if attempt > 1 {
			logger.Info("job claim succeeded after retries", "attempts", attempt)
		}
		c.queue.Forget(key)
	case errors.Is(err, ErrAlreadyClaimed) && !staleClaimRead:
		logger.Debug("job already claimed by another worker - dropping from queue")
		c.queue.Forget(key)
	case apierrors.IsNotFound(err) && !staleClaimRead:
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
	case staleClaimRead && attempt < maxStaleClaimAttempts:
		c.staleReads.RecordRetried()
		logger.Info("job announced but not yet visible to this read path - will retry claim",
			"attempt", attempt, "max_attempts", maxStaleClaimAttempts)
		c.setQueued(key, queued.trigger, queued.enqueued)
		c.queue.AddRateLimited(key)
	case attempt >= maxClaimAttempts:
		if staleClaimRead {
			c.staleReads.RecordExhausted()
		}
		logger.Error("job failed too many times - dropping from queue; the informer re-list re-adds it if still unclaimed",
			"attempts", attempt, "error", err)
		c.queue.Forget(key)
	default:
		// Only claim-path failures reach here; the job was never claimed by this
		// worker, so retrying cannot re-run any work. Re-set the attribution the
		// pickup popped so the retry keeps it (unless a concurrent enqueue set a
		// newer one).
		logger.Warn("failed to claim job - will retry",
			"attempt", attempt, "max_attempts", maxClaimAttempts, "error", err)
		c.setQueued(key, queued.trigger, queued.enqueued)
		c.queue.AddRateLimited(key)
	}
	return true
}
