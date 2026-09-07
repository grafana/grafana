package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/retry"
	"k8s.io/client-go/util/workqueue"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/prometheus/client_golang/prometheus"
)

const loggerName = "provisioning-repository-controller"

const (
	maxAttempts = 3
)

//go:generate mockery --name finalizerProcessor --structname MockFinalizerProcessor --inpackage --filename finalizer_mock.go --with-expecter
type finalizerProcessor interface {
	process(ctx context.Context, repo repository.Repository, finalizers []string) error
}

// RepositoryController controls how and when CRD is established.
type RepositoryController struct {
	client client.ProvisioningV0alpha1Interface
	repos  informer.RepositoryGetter
	logger logging.Logger

	jobs interface {
		jobs.Queue
		jobs.Store
	}
	finalizer     finalizerProcessor
	statusPatcher StatusPatcher

	repoFactory       repository.Factory
	connectionFactory connection.Factory
	healthChecker     *RepositoryHealthChecker
	quotaChecker      *RepositoryQuotaChecker
	// To allow injection for testing.
	processFn         func(key string) error
	enqueueRepository func(obj any, trigger usinformer.ProcessTrigger)
	keyFunc           func(obj any) (string, error)

	queue           workqueue.TypedRateLimitingInterface[string]
	resyncInterval  time.Duration
	minSyncInterval time.Duration
	drainTimeout    time.Duration

	// processed classifies each delivery (encapsulating the NATS/apiserver
	// backend) and records the processing metrics by what enqueued the key.
	// triggers carries that attribution from enqueue to dequeue, guarded by
	// triggersMu (entries live only between enqueue and Forget).
	processed  *usinformer.ProcessedMetrics
	triggersMu sync.Mutex
	triggers   map[string]usinformer.ProcessTrigger

	registry                      prometheus.Registerer
	tracer                        tracing.Tracer
	quotaGetter                   quotas.QuotaGetter
	tokenMetrics                  *repositoryTokenMetrics
	incrementalPolicy             repository.IncrementalSyncPolicy
	webhookSecretRotationInterval time.Duration
}

// NewRepositoryController creates new RepositoryController.
func NewRepositoryController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	repos informer.RepositoryGetter,
	repoFactory repository.Factory,
	connectionFactory connection.Factory,
	resourceLister resources.ResourceLister,
	clients resources.ClientFactory,
	jobs interface {
		jobs.Queue
		jobs.Store
	},
	healthChecker *RepositoryHealthChecker,
	statusPatcher StatusPatcher,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	parallelOperations int,
	resyncInterval time.Duration,
	minSyncInterval time.Duration,
	drainTimeout time.Duration,
	quotaGetter quotas.QuotaGetter,
	quotaChecker *RepositoryQuotaChecker,
	incrementalPolicy repository.IncrementalSyncPolicy,
	webhookSecretRotationInterval time.Duration,
	natsBacked bool,
) *RepositoryController {
	finalizerMetrics := registerFinalizerMetrics(registry)
	repoTokenMetrics := registerRepositoryTokenMetrics(registry)

	rc := &RepositoryController{
		client:    provisioningClient,
		repos:     repos,
		processed: usinformer.NewProcessedMetrics(registry, "repositories", natsBacked),
		triggers:  make(map[string]usinformer.ProcessTrigger),
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{
				Name:            "provisioningRepositoryController",
				MetricsProvider: newWorkerQueueWaitProvider(registry, "repository"),
			},
		),
		repoFactory:       repoFactory,
		connectionFactory: connectionFactory,
		healthChecker:     healthChecker,
		quotaChecker:      quotaChecker,
		statusPatcher:     statusPatcher,
		finalizer: &finalizer{
			lister:        resourceLister,
			clientFactory: clients,
			jobs:          jobs,
			metrics:       &finalizerMetrics,
			maxWorkers:    parallelOperations,
		},
		jobs:                          jobs,
		logger:                        logging.DefaultLogger.With("logger", loggerName),
		registry:                      registry,
		tracer:                        tracer,
		resyncInterval:                resyncInterval,
		minSyncInterval:               minSyncInterval,
		drainTimeout:                  drainTimeout,
		quotaGetter:                   quotaGetter,
		tokenMetrics:                  repoTokenMetrics,
		incrementalPolicy:             incrementalPolicy,
		webhookSecretRotationInterval: webhookSecretRotationInterval,
	}

	rc.processFn = rc.process
	rc.enqueueRepository = rc.enqueue
	rc.keyFunc = repoKeyFunc

	// Expose the local work-queue depth as a scrape-time gauge. The queue is
	// per-replica, so Prometheus target labels (pod/instance) distinguish replicas;
	// no metric label is needed. A GaugeFunc reads the authoritative Len() at scrape
	// time, so it cannot drift the way manual inc/dec would.
	registry.MustRegister(prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_repository_worker_queue_size",
			Help: "Number of repository keys waiting in this replica's local work queue",
		},
		func() float64 { return float64(rc.queue.Len()) },
	))

	return rc
}

// EventHandler returns the informer event handlers for the controller. Register
// it with the Repository informer to enqueue repositories on add and update.
func (rc *RepositoryController) EventHandler() cache.ResourceEventHandlerDetailedFuncs {
	return cache.ResourceEventHandlerDetailedFuncs{
		AddFunc: func(obj interface{}, isInInitialList bool) {
			rc.enqueueRepository(obj, rc.processed.ClassifyAdd(objectResourceVersion(obj), isInInitialList))
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			rc.enqueueRepository(newObj, rc.processed.ClassifyUpdate(objectResourceVersion(oldObj), objectResourceVersion(newObj)))
		},
	}
}

func repoKeyFunc(obj any) (string, error) {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return "", fmt.Errorf("expected a Repository but got %T", obj)
	}
	return cache.DeletionHandlingMetaNamespaceKeyFunc(repo)
}

// objectResourceVersion returns the resource version of a delivered Repository,
// or "" for a minimal NATS live event or a delete tombstone.
func objectResourceVersion(obj any) string {
	if repo, ok := obj.(*provisioning.Repository); ok {
		return repo.ResourceVersion
	}
	return ""
}

// Run starts the RepositoryController.
//
// The onStarted callback is invoked once all workers have been launched.
// The onShutdown callback is invoked immediately when context cancellation is
// detected, before draining in-flight work.
//
// Note: This function intentionally does NOT create a tracing span because it runs indefinitely
// until shutdown. Individual processing operations already have their own spans.
func (rc *RepositoryController) Run(ctx context.Context, workerCount int, onStarted func(), onShutdown func()) {
	defer utilruntime.HandleCrash()
	defer rc.queue.ShutDown()

	logger := rc.logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting RepositoryController")
	defer logger.Info("Shutting down RepositoryController")

	logger.Info("Starting workers", "count", workerCount)
	for i := 0; i < workerCount; i++ {
		workerCtx := logging.Context(ctx, logger.With("worker_id", i))
		go wait.UntilWithContext(workerCtx, rc.runWorker, time.Second)
	}

	logger.Info("Started workers")
	onStarted()

	<-ctx.Done()
	onShutdown()
	logger.Info("Shutting down workers, draining queue")

	drainDone := make(chan struct{})
	go func() {
		rc.queue.ShutDownWithDrain()
		close(drainDone)
	}()

	select {
	case <-drainDone:
		logger.Info("Queue drained successfully")
	case <-time.After(rc.drainTimeout):
		logger.Warn("Drain timeout exceeded, forcing shutdown")
		rc.queue.ShutDown()
	}
}

func (rc *RepositoryController) runWorker(ctx context.Context) {
	for rc.processNextWorkItem(ctx) {
	}
}

func (rc *RepositoryController) enqueue(obj interface{}, trigger usinformer.ProcessTrigger) {
	key, err := rc.keyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("couldn't get key for object: %v", err))
		return
	}
	// Attribute the key before the enqueue so a worker that dequeues immediately
	// sees it.
	rc.setTrigger(key, trigger)
	rc.queue.Add(key)
}

// setTrigger records what enqueued key, first-wins: the enqueue that first
// queued the key owns the attribution, and later deliveries that coalesce onto
// the still-queued key (or a retry re-set) leave it alone — the source that
// actually caused the pickup. The map is lazily created so tests that build the
// controller as a struct literal need not initialize it.
func (rc *RepositoryController) setTrigger(key string, trigger usinformer.ProcessTrigger) {
	rc.triggersMu.Lock()
	defer rc.triggersMu.Unlock()
	if rc.triggers == nil {
		rc.triggers = make(map[string]usinformer.ProcessTrigger)
	}
	if _, ok := rc.triggers[key]; !ok {
		rc.triggers[key] = trigger
	}
}

// popTrigger reads and removes key's attribution. Each pickup pops its own entry
// up front, so the entry never outlives the key however the pickup ends, and a
// concurrent enqueue that races an in-flight reconcile (setting a fresh entry
// and marking the key dirty — e.g. a status update the reconcile itself
// produced) keeps its attribution for the redelivery, which a terminal
// queue.Forget must not clobber. A retry re-sets the popped trigger before
// re-queuing so later attempts keep the original attribution.
func (rc *RepositoryController) popTrigger(key string) (usinformer.ProcessTrigger, bool) {
	rc.triggersMu.Lock()
	defer rc.triggersMu.Unlock()
	trigger, ok := rc.triggers[key]
	if ok {
		delete(rc.triggers, key)
	}
	return trigger, ok
}

// processNextWorkItem deals with one key off the queue.
// It returns false when it's time to quit.
func (rc *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	key, quit := rc.queue.Get()
	if quit {
		return false
	}
	defer rc.queue.Done(key)

	namespace, name, _ := cache.SplitMetaNamespaceKey(key)
	logger := logging.FromContext(ctx).With("work_key", key, "namespace", namespace, "repository", name)
	logger.Info("RepositoryController processing key")

	// Pop this pickup's attribution up front so the entry is cleared however the
	// key leaves this function, without a terminal Forget clobbering a newer
	// attribution set by a concurrent enqueue while the key was in flight.
	trigger, ok := rc.popTrigger(key)

	// NumRequeues counts prior AddRateLimited calls; add 1 for the current attempt.
	attempts := rc.queue.NumRequeues(key) + 1
	// Count the start of processing once per pickup, but only for a pickup that
	// corresponds to an informer delivery (a present entry). A missing entry is
	// an internal re-schedule with no informer event behind it — the token
	// read-after-write AddAfter below re-adds the key without an entry — so it
	// must not be counted, or it would masquerade as a relist recovery. Retries
	// keep the entry (re-set below) but bump NumRequeues, so they are not
	// recounted.
	if ok && attempts == 1 {
		rc.processed.RecordProcessed(trigger)
	}

	err := rc.processFn(key)
	if err == nil {
		rc.queue.Forget(key)
		return true
	}

	logger = logger.With("error", err, "attempts", attempts)
	logger.Error("RepositoryController failed to process key")

	if attempts >= maxAttempts {
		logger.Error("RepositoryController failed too many times")
		rc.queue.Forget(key)
		return true
	}

	if !apierrors.IsServiceUnavailable(err) {
		logger.Info("RepositoryController will not retry")
		rc.queue.Forget(key)
		return true
	} else {
		logger.Info("RepositoryController will retry as service is unavailable")
	}

	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", key, err))
	// Re-set the attribution the pickup popped so the retry keeps it (unless a
	// concurrent enqueue set a newer one). Only if this pickup had one: an
	// internal re-schedule carries no attribution and must not fabricate one.
	if ok {
		rc.setTrigger(key, trigger)
	}
	rc.queue.AddRateLimited(key)

	return true
}

func (rc *RepositoryController) handleDelete(ctx context.Context, obj *provisioning.Repository) error {
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.handle_delete", repoSpanAttrs(obj))
	defer span.End()

	logger := logging.FromContext(ctx)
	logger.Info("handle repository delete")

	// Process any finalizers
	if len(obj.Finalizers) > 0 {
		repo, err := rc.repoFactory.Build(ctx, obj)
		if err != nil {
			return fmt.Errorf("create repository from configuration: %w", err)
		}

		err = rc.finalizer.process(ctx, repo, obj.Finalizers)
		if err != nil {
			if statusErr := rc.updateDeleteStatus(ctx, obj, fmt.Errorf("remove finalizers: %w", err)); statusErr != nil {
				logger.Error("failed to update repository status after finalizer removal error", "error", statusErr)
			}
			return fmt.Errorf("process finalizers: %w", err)
		}

		// remove the finalizers. Retry on optimistic-concurrency conflicts:
		// the apiserver translates this JSON Patch into a read-modify-write
		// with PreviousRV set, so concurrent writes on the repository race
		// with this call and legitimately succeed on retry.
		err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
			_, err := rc.client.Repositories(obj.GetNamespace()).
				Patch(ctx, obj.Name, types.JSONPatchType, []byte(`[
					{ "op": "remove", "path": "/metadata/finalizers" }
				]`), v1.PatchOptions{
					FieldManager: "provisioning-controller",
				})
			return err
		})
		if err != nil {
			return fmt.Errorf("remove finalizers: %w", err)
		}
		return nil
	} else {
		logger.Info("no finalizers to process")
	}

	return nil
}

func (rc *RepositoryController) updateDeleteStatus(ctx context.Context, obj *provisioning.Repository, err error) error {
	logger := logging.FromContext(ctx)
	logger.Info("updating repository status with deletion error", "error", err.Error())
	return rc.statusPatcher.Patch(ctx, obj, map[string]interface{}{
		"op":    "replace",
		"path":  "/status/deleteError",
		"value": err.Error(),
	})
}

func (rc *RepositoryController) shouldResync(ctx context.Context, obj *provisioning.Repository) bool {
	// don't trigger resync if a sync was never started
	if obj.Status.Sync.Finished == 0 && obj.Status.Sync.State == "" {
		return false
	}

	syncAge := time.Since(time.UnixMilli(obj.Status.Sync.Finished))
	syncInterval := time.Duration(obj.Spec.Sync.IntervalSeconds) * time.Second
	if syncInterval < rc.minSyncInterval {
		// In case the sync interval is lower than the minimum sync interval set by the system
		// we should default to the latter
		syncInterval = rc.minSyncInterval
	}
	tolerance := time.Second

	// Check for stale sync status - if sync status indicates a job is running but the job no longer exists
	// Only check if Finished is set (meaning a sync has completed before) to avoid interfering with initial syncs
	// Only trigger resync if sync is enabled and sync interval has elapsed (to avoid unnecessary operations)
	if obj.Status.Sync.Finished > 0 &&
		obj.Spec.Sync.Enabled &&
		(obj.Status.Sync.State == provisioning.JobStatePending || obj.Status.Sync.State == provisioning.JobStateWorking) &&
		obj.Status.Sync.JobID != "" {
		_, err := rc.jobs.Get(ctx, obj.Namespace, obj.Status.Sync.JobID)
		if apierrors.IsNotFound(err) {
			// Job was cleaned up but sync status wasn't updated - trigger resync to reconcile
			// Only trigger if sync interval has elapsed to avoid unnecessary operations
			if syncAge >= (syncInterval - tolerance) {
				logger := logging.FromContext(ctx)
				logger.Info("detected stale sync status", "job_id", obj.Status.Sync.JobID)
				return true
			}
		}
		// For other errors, log but continue with normal logic
		if err != nil {
			logger := logging.FromContext(ctx)
			logger.Warn("failed to check job existence for stale sync status", "error", err, "job_id", obj.Status.Sync.JobID)
		}
	}

	// HACK: how would this work in a multi-tenant world or under heavy load?
	// It will start queueing up jobs and we will have to deal with that
	pendingForTooLong := syncAge >= syncInterval/2 && obj.Status.Sync.State == provisioning.JobStatePending
	isRunning := obj.Status.Sync.State == provisioning.JobStateWorking

	return obj.Spec.Sync.Enabled && syncAge >= (syncInterval-tolerance) && !pendingForTooLong && !isRunning
}

func (rc *RepositoryController) runHooks(ctx context.Context, repo repository.Repository, obj *provisioning.Repository) ([]map[string]interface{}, error) {
	logger := logging.FromContext(ctx)
	webhookRepo, ok := repo.(repository.WebhookRepository)
	if !ok {
		return nil, nil
	}

	if obj.Status.ObservedGeneration < 1 {
		logger.Info("handle repository create")
		patchOperations, err := webhookOnCreate(ctx, webhookRepo)
		if err != nil {
			return nil, fmt.Errorf("error running webhookOnCreate: %w", err)
		}
		return patchOperations, nil
	}

	logger.Info("handle repository spec update", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
	patchOperations, err := webhookOnUpdate(ctx, webhookRepo)
	if err != nil {
		return nil, fmt.Errorf("error running webhookOnUpdate: %w", err)
	}

	return patchOperations, nil
}

// isQuotaExceeded checks if the given conditions have a RepositoryQuotaExceeded one.
func isQuotaExceeded(conditions []v1.Condition) bool {
	for _, condition := range conditions {
		if condition.Type == provisioning.ConditionTypeNamespaceQuota {
			return condition.Status == v1.ConditionFalse &&
				condition.Reason == provisioning.ReasonQuotaExceeded
		}
	}
	return false
}

func (rc *RepositoryController) determineSyncStrategy(
	ctx context.Context,
	obj *provisioning.Repository,
	repo repository.Repository,
	shouldResync bool,
	isBlocked bool,
	healthStatus provisioning.HealthStatus,
) *provisioning.SyncJobOptions {
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.determine_sync_strategy", repoSpanAttrs(obj))
	defer span.End()

	logger := logging.FromContext(ctx)

	switch {
	case !obj.Spec.Sync.Enabled:
		logger.Info("skip sync as it's disabled in the repository spec")
		return nil
	case isBlocked:
		logger.Info("skip sync as the repository is blocked for exceeding its namespace quota")
		return nil
	case !healthStatus.Healthy:
		// Surface why the repository is unhealthy so operators can act without
		// having to inspect the repository status separately. The health error
		// type and messages are the same ones exposed on /status/health.
		logger.Info("skip sync as the repository is unhealthy",
			"health_error", healthStatus.Error,
			"health_messages", healthStatus.Message,
			"health_checked", time.UnixMilli(healthStatus.Checked))
		return nil
	case healthStatus.Healthy != obj.Status.Health.Healthy:
		logger.Info("full resync as the repository recovered from an unhealthy state")
		return &provisioning.SyncJobOptions{}
	case obj.Status.ObservedGeneration < 1:
		logger.Info("full sync as this is the first sync for a new repository")
		return &provisioning.SyncJobOptions{}
	case obj.Generation != obj.Status.ObservedGeneration:
		logger.Info("full sync as the repository spec changed",
			"generation", obj.Generation, "observed_generation", obj.Status.ObservedGeneration)
		return &provisioning.SyncJobOptions{}
	case shouldResync:
		// Continue to see if we could skip for other reasons
		versioned, ok := repo.(repository.Versioned)
		// If the repository is not versioned, we don't have a way to check for incremental updates
		if !ok {
			logger.Info("full sync on interval as the repository is not versioned and cannot be diffed incrementally")
			return &provisioning.SyncJobOptions{}
		}
		latestRef, err := versioned.LatestRef(ctx)
		if err != nil {
			logger.Warn("falling back to incremental sync on interval as the latest ref could not be resolved to detect changes", "error", err)
			return &provisioning.SyncJobOptions{Incremental: true}
		}

		// Only resync if the latest ref is different from the last synced ref
		if latestRef == obj.Status.Sync.LastRef {
			logger.Info("skip sync on interval as the latest ref matches the last synced ref",
				"ref", latestRef)
			return nil
		}

		// Whenever possible, we try to keep it as an incremental sync to keep things performant.
		// However, we fall back to a full sync when incremental diffing cannot safely represent the change,
		// such as .keep file deletions inside a folder with no other deletions (to detect whether the folder
		// was deleted in git) or when the diff size reaches/exceeds max_incremental_changes.
		incremental, err := shouldUseIncrementalSync(ctx, versioned, obj, latestRef, rc.incrementalPolicy)
		if err != nil {
			logger.Warn("falling back to full sync on interval as files could not be compared for an incremental sync",
				"error", err, "from_ref", obj.Status.Sync.LastRef, "to_ref", latestRef)
			return &provisioning.SyncJobOptions{}
		}

		logger.Info("sync on interval as the latest ref changed",
			"incremental", incremental, "from_ref", obj.Status.Sync.LastRef, "to_ref", latestRef)
		return &provisioning.SyncJobOptions{Incremental: incremental}
	default:
		return nil
	}
}

func shouldUseIncrementalSync(
	ctx context.Context,
	versioned repository.Versioned,
	obj *provisioning.Repository,
	latestRef string,
	policy repository.IncrementalSyncPolicy,
) (bool, error) {
	changes, err := versioned.CompareFiles(ctx, obj.Status.Sync.LastRef, latestRef)
	if err != nil {
		return false, err
	}

	var deletedPaths []string
	for _, change := range changes {
		if change.Action == repository.FileActionDeleted {
			deletedPaths = append(deletedPaths, change.Path)
		}
	}

	return policy.CanUseIncrementalSync(deletedPaths, len(changes)), nil
}

func (rc *RepositoryController) addSyncJob(ctx context.Context, obj *provisioning.Repository, syncOptions *provisioning.SyncJobOptions) error {
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.add_sync_job", repoSpanAttrs(obj))
	defer span.End()

	span.SetAttributes(
		attribute.Bool("incremental", syncOptions != nil && syncOptions.Incremental),
	)

	job, err := rc.jobs.Insert(ctx, obj.Namespace, provisioning.JobSpec{
		Repository: obj.GetName(),
		Action:     provisioning.JobActionPull,
		Pull:       syncOptions,
	})
	if apierrors.IsAlreadyExists(err) {
		logging.FromContext(ctx).Info("sync job already exists")
		return nil
	}
	if err != nil {
		span.RecordError(err)
		// FIXME: should we update the status of the repository if we fail to add the job?
		return fmt.Errorf("error adding sync job: %w", err)
	}

	span.SetAttributes(attribute.String("job.name", job.Name))
	return nil
}

func (rc *RepositoryController) determineSyncStatusOps(obj *provisioning.Repository, syncOptions *provisioning.SyncJobOptions, healthStatus provisioning.HealthStatus) []map[string]interface{} {
	const unhealthyMessage = "Repository is unhealthy"

	hasUnhealthyMessage := len(obj.Status.Sync.Message) > 0 && obj.Status.Sync.Message[0] == unhealthyMessage
	var patchOperations []map[string]interface{}

	switch {
	case syncOptions != nil:
		// We will try to trigger a new sync job if we have sync options
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/state",
			"value": provisioning.JobStatePending,
		})
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/started",
			"value": int64(0),
		})
	case healthStatus.Healthy && hasUnhealthyMessage: // if the repository is healthy and the message is set, clear it
		// FIXME: is this the clearest way to do this? Should we introduce another status or way of way of handling more
		// specific errors?
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/message",
			"value": []string{},
		})
	case !healthStatus.Healthy && !hasUnhealthyMessage: // if the repository is unhealthy and the message is not already set, set it
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/state",
			"value": provisioning.JobStateError,
		})
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync/message",
			"value": []string{unhealthyMessage},
		})
	}

	return patchOperations
}

// repoSpanAttrs returns the resource-identifying attributes stamped on every
// reconcile child span, so a span is self-describing in isolation (e.g. a
// handle_delete or health_check span says which repository, and of what type,
// it concerns) rather than only via its parent.
func repoSpanAttrs(obj *provisioning.Repository) trace.SpanStartOption {
	return trace.WithAttributes(
		attribute.String("repository.name", obj.GetName()),
		attribute.String("repository.namespace", obj.GetNamespace()),
		attribute.String("repository.type", string(obj.Spec.Type)),
	)
}

//nolint:gocyclo
func (rc *RepositoryController) process(key string) (err error) {
	logger := rc.logger.With("key", key)
	ctx := logging.Context(context.Background(), logger)

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	// process runs from a background context, so this opens a fresh trace per
	// reconcile whose children show where the reconcile spends its time.
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.reconcile",
		trace.WithAttributes(
			attribute.String("repository.namespace", namespace),
			attribute.String("repository.name", name),
		),
	)
	defer span.End()
	defer func() {
		if err != nil {
			_ = tracing.Error(span, err)
		}
	}()

	// Reconcile the object the read seam returns; how it is sourced and kept
	// fresh is the informer.RepositoryGetter's concern, not the controller's.
	obj, err := rc.repos.Get(ctx, namespace, name)
	switch {
	case apierrors.IsNotFound(err):
		return errors.New("repository not found")
	case err != nil:
		return err
	}

	logger = logger.With(
		"namespace", namespace,
		"repository", name,
		"repositoryType", string(obj.Spec.Type),
		"connection", obj.ConnectionName(),
	)
	ctx = logging.Context(ctx, logger)

	span.SetAttributes(
		attribute.String("repository.type", string(obj.Spec.Type)),
		attribute.String("repository.connection", obj.ConnectionName()),
	)

	ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return err
	}
	ctx = request.WithNamespace(ctx, namespace)
	logger = logger.WithContext(ctx)

	if obj.DeletionTimestamp != nil {
		return rc.handleDelete(ctx, obj)
	}

	// Skip reconciliation for resources whose namespace is being soft-deleted.
	if appcontroller.IsPendingDelete(obj.Labels) {
		logger.Info("skipping reconciliation: namespace is pending deletion")
		return nil
	}

	// Check quota state early - before trigger evaluation
	// This allows blocked repos to check if they can unblock even without other triggers
	newQuota, err := rc.quotaGetter.GetQuotaStatus(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to get quota status: %w", err)
	}
	quotaCtx, quotaSpan := rc.tracer.Start(ctx, "provisioning.controller.check_quota", repoSpanAttrs(obj))
	quotaCondition, err := rc.quotaChecker.RepositoryQuotaConditions(quotaCtx, namespace, newQuota)
	quotaSpan.End()
	if err != nil {
		return fmt.Errorf("check repository quota: %w", err)
	}
	isCurrentlyBlocked := isQuotaExceeded(obj.Status.Conditions)
	isOverQuota := isQuotaExceeded([]v1.Condition{quotaCondition})

	// Blocked repos MUST process to check if they can unblock
	forceProcessForUnblock := isCurrentlyBlocked && !isOverQuota

	shouldResync := rc.shouldResync(ctx, obj)
	shouldCheckHealth := rc.healthChecker.ShouldCheckHealth(obj)
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration
	var patchOperations []map[string]interface{}

	// applyPatches flushes any patches not yet written
	applyPatches := func() error {
		if len(patchOperations) == 0 {
			return nil
		}
		ops := patchOperations
		patchOperations = nil
		patchCtx, patchSpan := rc.tracer.Start(ctx, "provisioning.controller.apply_status",
			repoSpanAttrs(obj),
			trace.WithAttributes(attribute.Int("patch.operations", len(ops))),
		)
		defer patchSpan.End()
		if patchErr := rc.statusPatcher.Patch(patchCtx, obj, ops...); patchErr != nil {
			return fmt.Errorf("status patch operations failed: %w", patchErr)
		}
		return nil
	}
	defer func() {
		if patchErr := applyPatches(); patchErr != nil {
			logger.Error("failed to apply patches", "error", patchErr)
			if err == nil {
				err = patchErr
			} else {
				err = errors.Join(err, patchErr)
			}
		}
	}()

	hasQuotaChanged := obj.Status.Quota.MaxRepositories != newQuota.MaxRepositories ||
		obj.Status.Quota.MaxResourcesPerRepository != newQuota.MaxResourcesPerRepository

	var shouldGenerateToken bool
	if obj.Spec.Connection != nil && obj.Spec.Connection.Name != "" {
		shouldGenerateToken = rc.shouldGenerateTokenFromConnection(obj)
	}

	shouldRotateWebhookSecret := rc.shouldRotateWebhookSecret(obj)

	// Determine the main triggering condition
	var reason string
	switch {
	// First, we check if the repository is blocked
	case isCurrentlyBlocked && isOverQuota:
		reason = "blocked_over_quota"
		logger.Info("repository blocked and over quota, reconciling but skipping sync")
	case !isCurrentlyBlocked && isOverQuota:
		reason = "over_quota"
		logger.Info("namespace over quota, blocking repository", "max_repositories", newQuota.MaxRepositories)
	case hasSpecChanged:
		reason = "spec_changed"
		logger.Info("spec changed", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
	case shouldResync:
		reason = "resync_interval"
		logger.Info("sync interval triggered", "sync_interval", time.Duration(obj.Spec.Sync.IntervalSeconds)*time.Second, "sync_status", obj.Status.Sync)
	case shouldCheckHealth:
		reason = "health_stale"
		logger.Info("health is stale", "health_status", obj.Status.Health.Healthy)
	case forceProcessForUnblock:
		reason = "unblock"
		logger.Info("repository was blocked but now within quota, processing to unblock")
	case shouldGenerateToken:
		reason = "token_generation"
		logger.Info("repository token needs to be generated", "connection", obj.Spec.Connection.Name)
	case hasQuotaChanged:
		reason = "quota_changed"
		logger.Info("quota changed", "quota", newQuota)
	case len(obj.Spec.Workflows) > 0 && repository.GetID(obj.Status.Webhook).IsEmpty():
		reason = "webhook_missing"
		logger.Info("webhook missing, reconciling")
	case shouldRotateWebhookSecret:
		reason = "webhook_secret_rotation"
		logger.Info("webhook secret rotation due")
	default:
		span.SetAttributes(attribute.String("reconcile.reason", "skipped"))
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "sync_spec", obj.Spec.Sync)
		return nil
	}
	span.SetAttributes(attribute.String("reconcile.reason", reason))

	// Set quota information from configuration (only if changed)
	if hasQuotaChanged {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/quota",
			"value": newQuota,
		})
	}

	if shouldGenerateToken {
		logger.Info("updating token for repository")

		c, err := rc.client.Connections(obj.Namespace).Get(ctx, obj.Spec.Connection.Name, v1.GetOptions{})
		if err != nil {
			logger.Error("retrieving connection", "error", err)
			return err
		}

		token, tokenOps, err := rc.generateRepositoryToken(ctx, obj, c)
		if err != nil {
			logger.Error("generating token for repository", "error", err)
			return err
		}

		if len(tokenOps) > 0 {
			patchOperations = append(patchOperations, tokenOps...)
		}

		obj.Secure.Token.Create = token
	}

	buildCtx, buildSpan := rc.tracer.Start(ctx, "provisioning.controller.build", repoSpanAttrs(obj))
	repo, err := rc.repoFactory.Build(buildCtx, obj)
	buildSpan.End()
	if err != nil {
		// The token references a stored secret that could not be decrypted (e.g. an
		// orphaned reference whose secret was deleted). When the token is minted from a
		// connection, regenerate it and rebuild rather than failing the reconcile forever.
		// shouldGenerateToken being false guarantees we did not already mint one this pass.
		if errors.Is(err, repository.ErrTokenNotFound) && !shouldGenerateToken &&
			obj.Spec.Connection != nil && obj.Spec.Connection.Name != "" {
			// If we wrote a token for this repository very recently, its secret may not be
			// readable from the store yet. Wait for it rather than regenerating, which would
			// delete it and can loop under secret-store read-after-write lag.
			if tokenRecentlyCreated(time.UnixMilli(obj.Status.Token.LastUpdated)) {
				logger.Info("repository token secret not yet readable after recent write; will retry", "error", err)
				rc.queue.AddAfter(key, tokenWriteRetryDelay)
				return nil
			}

			logger.Warn("repository token secret could not be decrypted, regenerating from connection",
				"connection", obj.Spec.Connection.Name, "error", err)

			c, cerr := rc.client.Connections(obj.Namespace).Get(ctx, obj.Spec.Connection.Name, v1.GetOptions{})
			if cerr != nil {
				return fmt.Errorf("retrieving connection to regenerate token: %w", cerr)
			}

			token, tokenOps, gerr := rc.generateRepositoryToken(ctx, obj, c)
			if gerr != nil {
				return fmt.Errorf("regenerating repository token: %w", gerr)
			}

			if len(tokenOps) > 0 {
				patchOperations = append(patchOperations, tokenOps...)
			}
			// Work on a copy so we don't mutate the shared informer-cache object, and
			// overwrite the whole value so the stale reference name is cleared too.
			obj = obj.DeepCopy()
			obj.Secure.Token = common.InlineSecureValue{Create: token}

			repo, err = rc.repoFactory.Build(ctx, obj)
		}
		if err != nil {
			return fmt.Errorf("unable to create repository from configuration: %w", err)
		}
	}

	// If branch is empty, fetch and set the default branch before running health check
	if branchHandler, ok := repo.(repository.BranchHandler); ok {
		if branchHandler.GetCurrentBranch() == "" {
			logger.Info("given repository branch is empty, getting default branch")

			branchCtx, branchSpan := rc.tracer.Start(ctx, "provisioning.controller.get_default_branch", repoSpanAttrs(obj))
			defaultBranch, err := branchHandler.GetDefaultBranch(branchCtx)
			branchSpan.End()
			if err != nil {
				return fmt.Errorf("failed to get default branch: %w", err)
			}

			branchHandler.SetBranch(defaultBranch)

			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "replace",
				"path":  fmt.Sprintf("/spec/%s/branch", repo.Config().Spec.Type),
				"value": defaultBranch,
			})
		}
	}

	// Backfill the pinned repo ID for repos written before it was resolved
	// at admission time, so Build doesn't keep re-resolving it on every call.
	if repoIDHandler, ok := repo.(repository.RepoIDHandler); ok && repoIDHandler.ShouldUpdateRepoID() {
		repoPath := fmt.Sprintf("/spec/%s", obj.Spec.Type)
		// Must add the `test` patch on the url to ensure it hasn't changed.
		// Race condition is:
		// 1. Read cfg.URL -> urlA, resolving to repoIDA
		// 2. Concurrently, a successful write happens updating urlA -> urlB, and repoIDA -> repoIDB
		// 3. We try to patch with repoIDA - without the `test` op, this will succeed and there will be a mismatch
		// between urlB and repoIDA
		patchOperations = append(patchOperations,
			map[string]interface{}{
				"op":    "test",
				"path":  repoPath + "/url",
				"value": obj.URL(),
			},
			map[string]interface{}{
				"op":    "add",
				"path":  repoPath + "/repoID",
				"value": repoIDHandler.ResolvedRepoID(),
			},
		)
	}

	// Run before processHooks to avoid attempting to hit webhooks if repo is already known to be unhealthy
	healthCtx, healthSpan := rc.tracer.Start(ctx, "provisioning.controller.health_check", repoSpanAttrs(obj))
	healthResult, err := rc.healthChecker.RefreshHealthWithPatchOps(healthCtx, repo)
	healthSpan.End()
	if err != nil {
		return fmt.Errorf("update health status: %w", err)
	}
	testResults := healthResult.TestResults
	healthStatus := healthResult.HealthStatus
	// Captured before the over-quota override status below. We only block hooks being run if the repo is unreachable.
	// Also not every failed Test() means unreachable: e.g. branch protection blocking direct pushes is
	// reported. Hooks should still be able to run so a reachability-specific read of the test result is used
	// instead of the raw Success flag.
	reachable := isReachableTestResult(testResults)

	// If over quota, override health to unhealthy.
	if isOverQuota {
		healthStatus = provisioning.HealthStatus{
			Healthy: false,
			Error:   provisioning.HealthFailureHealth,
			Checked: time.Now().UnixMilli(),
			Message: []string{quotaCondition.Message},
		}

		healthResult.ReadyCondition = buildReadyConditionWithReason(healthStatus, provisioning.ReasonQuotaExceeded)
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": healthStatus,
		})
	} else if len(healthResult.PatchOps) > 0 {
		patchOperations = append(patchOperations, healthResult.PatchOps...)
	}

	hookOps, hookFailureStatus, hooksSuppressed, hookErr := rc.processHooks(ctx, repo, obj, reachable, shouldRotateWebhookSecret)
	if len(hookOps) > 0 {
		patchOperations = append(patchOperations, hookOps...)
	}
	if hookFailureStatus != nil {
		healthStatus = *hookFailureStatus
		healthResult.ReadyCondition = buildReadyConditionWithReason(healthStatus, classifyHookFailureReason(hookErr))
	}
	if hookErr != nil {
		if rc.isUserCaused(hookErr) {
			logger.Warn("repository hook failed with a user-facing error", "error", hookErr)
		} else {
			err = fmt.Errorf("process hooks: %w", hookErr)
		}
	}

	// Only mark this generation observed once hook processing wasn't suppressed
	// for being unreachable or in cooldown, AND didn't itself fail. processHooks
	// reports suppressed=false on a genuine runHooks failure (hooks were
	// attempted, not skipped), so hookErr must be checked separately here --
	// otherwise a failed webhook create/update/delete would still advance
	// observedGeneration, and since retries after this point only trigger on a
	// generation mismatch or a missing webhook, that failure would never be
	// retried once cooldown ends.
	if hasSpecChanged && hookErr == nil && !hooksSuppressed {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": obj.Generation,
		})
	}

	// Build ALL condition patches together to avoid one overwriting another.
	if conditionPatchOps := BuildConditionPatchOpsFromExisting(
		obj.Status.Conditions, obj.GetGeneration(), quotaCondition, healthResult.ReadyCondition,
	); conditionPatchOps != nil {
		patchOperations = append(patchOperations, conditionPatchOps...)
	}

	// Only update fieldErrors from test results if they have changed.
	// Updating patchOperations will bump the resourceVersion on every pass, which the
	// informer's UpdateFunc turns straight back into a re-enqueue and we will
	// immediately check for repoHealth
	if testResults != nil {
		fieldErrors := testResults.Errors
		if (len(fieldErrors) != 0 || len(obj.Status.FieldErrors) != 0) && !reflect.DeepEqual(obj.Status.FieldErrors, fieldErrors) {
			if fieldErrors == nil {
				fieldErrors = []provisioning.ErrorDetails{}
			}
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/fieldErrors",
				"value": fieldErrors,
			})
		}
	}

	// determine the sync strategy and sync status to apply
	syncOptions := rc.determineSyncStrategy(ctx, obj, repo, shouldResync, isOverQuota, healthStatus)
	patchOperations = append(patchOperations, rc.determineSyncStatusOps(obj, syncOptions, healthStatus)...)

	// Apply all patch operations
	if patchErr := applyPatches(); patchErr != nil {
		if err == nil {
			err = patchErr
		} else {
			err = errors.Join(err, patchErr)
		}
		return err
	}
	if err != nil {
		return err
	}

	// QUESTION: should we trigger the sync job after we have applied all patch operations or before?
	// Is there are risk of race condition here?
	// Trigger sync job after we have applied all patch operations
	if syncOptions != nil {
		if err := rc.addSyncJob(ctx, obj, syncOptions); err != nil {
			return err
		}
	}

	return nil
}

// processHooks handles hook execution with intelligent retry logic. `suppressed`
// reports whether there was hook work to do (generation changed or webhook
// missing) that got skipped this pass due to cooldown/repo unreachability, as
// opposed to there being genuinely nothing to do — the caller uses this to
// decide whether it's safe to advance observedGeneration.
func (rc *RepositoryController) processHooks(ctx context.Context, repo repository.Repository, obj *provisioning.Repository, repoHealthy bool, shouldRotateSecret bool) (hookOps []map[string]interface{}, failureStatus *provisioning.HealthStatus, suppressed bool, err error) {
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.process_hooks", repoSpanAttrs(obj))
	defer span.End()
	webhookMissing := len(obj.Spec.Workflows) > 0 &&
		repository.GetID(obj.Status.Webhook).IsEmpty()

	shouldRunHooks := (obj.Generation != obj.Status.ObservedGeneration) || webhookMissing
	_, webhookCapable := repo.(repository.WebhookRepository)
	hasWebhookToManage := webhookCapable && (len(obj.Spec.Workflows) > 0 || !repository.GetID(obj.Status.Webhook).IsEmpty())

	// Suppress the hook retry while the hook-failure cooldown is active, or while
	// the repository just failed its health check (it's known unreachable, so any
	// create/update/delete call against it is doomed).
	if shouldRunHooks && hasWebhookToManage && (rc.healthChecker.inHookFailureCooldown(obj) || !repoHealthy) {
		shouldRunHooks = false
		suppressed = true
	}

	if shouldRunHooks {
		hookOps, err = rc.runHooks(ctx, repo, obj)
		if err != nil {
			status := rc.healthChecker.recordFailure(provisioning.HealthFailureHook, err)
			hookOps = append(hookOps, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/health",
				"value": status,
			})
			return hookOps, &status, false, err
		}
	}

	// Rotate the webhook secret if due. Skipped if unhealthy since EditWebhook
	// would be an equally doomed call against an unreachable repository, and
	// skipped during the hook-failure cooldown too: repoHealthy alone doesn't
	// catch this window, since a skipped health check reads as reachable.
	if webhookRepo, ok := repo.(repository.WebhookRepository); ok && shouldRotateSecret && repoHealthy && !rc.healthChecker.inHookFailureCooldown(obj) {
		rotateCtx, rotateSpan := rc.tracer.Start(ctx, "provisioning.controller.rotate_webhook_secret", repoSpanAttrs(obj))
		rotateOps, rotateErr := rotateWebhookSecret(rotateCtx, webhookRepo)
		rotateSpan.End()
		if rotateErr != nil {
			logging.FromContext(ctx).Warn("webhook secret rotation failed", "error", rotateErr)
		}
		if len(rotateOps) > 0 {
			hookOps = append(hookOps, rotateOps...)
		}
	}

	return hookOps, nil, suppressed, nil
}

// Returns errors that are due to user errors
func (rc *RepositoryController) isUserCaused(err error) bool {
	// List of errors that are user-facing errors and are left recorded on the repository
	if errors.Is(err, repository.ErrUnauthorized) ||
		errors.Is(err, repository.ErrPermissionDenied) {
		return true
	}

	return false
}

// classifyHookFailureReason maps a hook failure to a Ready condition reason,
// mirroring classifyTestResultReason's approach for health-check failures so
// an auth/permission problem is distinguishable from a generic failure
// instead of always reporting the same reason.
func classifyHookFailureReason(err error) string {
	switch {
	case errors.Is(err, repository.ErrUnauthorized), errors.Is(err, repository.ErrPermissionDenied):
		return provisioning.ReasonAuthenticationFailed
	case errors.Is(err, repository.ErrServerUnavailable):
		return provisioning.ReasonServiceUnavailable
	case errors.Is(err, repository.ErrTooManyRequests):
		return provisioning.ReasonRateLimited
	default:
		return provisioning.ReasonInvalidSpec
	}
}

func isReachableTestResult(testResults *provisioning.TestResults) bool {
	if testResults == nil || testResults.Success {
		return true
	}
	switch testResults.Code {
	case http.StatusForbidden:
		// Couldn't be written to, but was still reachable
		for _, e := range testResults.Errors {
			if e.Detail == repository.WritePermissionDeniedDetail {
				return true
			}
		}
		return false
	case http.StatusUnauthorized, http.StatusNotFound, http.StatusServiceUnavailable:
		return false
	default:
		return true
	}
}

// shouldRotateWebhookSecret returns true when a repository has an active webhook
// whose secret is due for rotation based on the configured interval.
func (rc *RepositoryController) shouldRotateWebhookSecret(obj *provisioning.Repository) bool {
	if rc.webhookSecretRotationInterval <= 0 {
		return false
	}
	if len(obj.Spec.Workflows) == 0 {
		return false
	}
	if repository.GetID(obj.Status.Webhook).IsEmpty() {
		return false
	}
	if obj.Status.Webhook.LastRotated == 0 {
		return true
	}
	age := time.Since(time.UnixMilli(obj.Status.Webhook.LastRotated))
	return age >= rc.webhookSecretRotationInterval
}

// HACK: we need a proper way of doing this check by adding Conditions
// We're going to work on this in https://github.com/grafana/git-ui-sync-project/issues/744.
func (rc *RepositoryController) shouldGenerateTokenFromConnection(
	obj *provisioning.Repository,
) bool {
	// We should generate a token from the connection when
	// - The token has never been generated, i.e. a new Repository is being added
	// or
	// - The token has not been recently created, and
	// - The token will expire before the next resync interval
	if obj.Secure.Token.IsZero() {
		rc.tokenMetrics.recordRefreshReason(refreshReasonMissing)
		return true
	}

	// The token was stored without expiration tracking; regenerate to backfill it.
	if obj.Status.Token.LastUpdated == 0 {
		rc.tokenMetrics.recordRefreshReason(refreshReasonMissing)
		return true
	}

	// A zero expiration means the token does not expire.
	if obj.Status.Token.Expiration == 0 {
		return false
	}

	expiration := time.UnixMilli(obj.Status.Token.Expiration)
	rc.tokenMetrics.recordTimeToExpiry(time.Until(expiration).Seconds())

	recentlyCreated := tokenRecentlyCreated(time.UnixMilli(obj.Status.Token.LastUpdated))
	if !recentlyCreated && shouldRefreshBeforeExpiration(expiration, rc.resyncInterval) {
		rc.tokenMetrics.recordRefreshReason(refreshReasonExpiring)
		return true
	}

	return false
}

func (rc *RepositoryController) generateRepositoryToken(
	ctx context.Context,
	obj *provisioning.Repository,
	c *provisioning.Connection,
) (_ common.RawSecureValue, _ []map[string]any, err error) {
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.generate_token", repoSpanAttrs(obj))
	defer span.End()
	defer func() {
		if err != nil {
			_ = tracing.Error(span, err)
		}
	}()

	start := time.Now()
	defer func() {
		elapsed := time.Since(start).Seconds()
		if err != nil {
			rc.tokenMetrics.recordGenerationError()
		} else {
			rc.tokenMetrics.recordGeneration(elapsed)
		}
	}()

	conn, err := rc.connectionFactory.Build(ctx, c)
	if err != nil {
		return "", nil, fmt.Errorf("unable to create connection from configuration: %w", err)
	}

	token, err := conn.GenerateRepositoryToken(ctx, obj)
	if err != nil {
		return "", nil, fmt.Errorf("unable to create token for repository: %w", err)
	}

	tokenStatus := provisioning.TokenStatus{LastUpdated: time.Now().UnixMilli()}
	if !token.ExpiresAt.IsZero() {
		tokenStatus.Expiration = token.ExpiresAt.UnixMilli()
	}

	patchOperations := []map[string]any{
		{
			"op":    "add",
			"path":  "/status/token",
			"value": tokenStatus,
		},
	}

	// HACK - here we need to do different things based on the status of repository
	// https://github.com/grafana/git-ui-sync-project/issues/745 to have a proper fix on it
	switch {
	case obj.Secure.IsZero():
		patchOperations = append(patchOperations, map[string]any{
			"op":   "add",
			"path": "/secure",
			"value": map[string]any{
				"token": map[string]string{
					"create": string(token.Token),
				},
			},
		})
	case obj.Secure.Token.IsZero():
		patchOperations = append(patchOperations, map[string]any{
			"op":   "add",
			"path": "/secure/token",
			"value": map[string]string{
				"create": string(token.Token),
			},
		})
	default:
		patchOperations = append(patchOperations, map[string]any{
			"op":   "replace",
			"path": "/secure/token",
			"value": map[string]string{
				"create": string(token.Token),
			},
		})
	}

	return token.Token, patchOperations, nil
}
