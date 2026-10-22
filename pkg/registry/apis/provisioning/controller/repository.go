package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"go.opentelemetry.io/otel/attribute"
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
	checkAge := time.Since(time.UnixMilli(max(obj.Status.Sync.Finished, obj.Status.Sync.LastChecked)))
	// In case the sync interval is lower than the minimum sync interval set by the system
	// we should default to the latter
	syncInterval := max(time.Duration(obj.Spec.Sync.IntervalSeconds)*time.Second, rc.minSyncInterval)
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

	return obj.Spec.Sync.Enabled && checkAge >= (syncInterval-tolerance) && !pendingForTooLong && !isRunning
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
	ctx, span := rc.tracer.Start(ctx, "provisioning.controller.add_sync_job")
	defer span.End()

	span.SetAttributes(
		attribute.String("repository", obj.GetName()),
		attribute.String("namespace", obj.Namespace),
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

func (rc *RepositoryController) determineSyncStatusOps(obj *provisioning.Repository, syncOptions *provisioning.SyncJobOptions, healthStatus provisioning.HealthStatus, shouldResync bool) []map[string]interface{} {
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
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "add",
			"path":  "/status/sync/lastChecked",
			"value": time.Now().UnixMilli(),
		})
	case healthStatus.Healthy:
		if hasUnhealthyMessage {
			// FIXME: is this the clearest way to do this? Should we introduce another status or way of way of handling more
			// specific errors?
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/sync/message",
				"value": []string{},
			})
		}
		if shouldResync {
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "add",
				"path":  "/status/sync/lastChecked",
				"value": time.Now().UnixMilli(),
			})
		}
	case !hasUnhealthyMessage: // if the repository is unhealthy and the message is not already set, set it
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

//nolint:gocyclo
func (rc *RepositoryController) process(key string) error {
	logger := rc.logger.With("key", key)
	ctx := logging.Context(context.Background(), logger)

	// phase tracks how far reconciliation has progressed so a failure is counted
	// under the stage it occurred in. Paths that surface an error on status and
	// return nil (token/build/delete/hook) can't rely on the returned error,
	// so they stash it in swallowedErr/swallowedPhase.
	//
	// The deferred recorder counts exactly one failure per reconcile and prefers
	// the error actually returned to the workqueue over a swallowed one: a
	// swallowed user-caused failure can be followed by a returned system error
	// (e.g. the deferred status flush failing) that the worker logs, and that
	// system failure must appear in the metric as cause="system". Registered
	// before the span defers so it runs last, after any deferred status flush has
	// finalized err.
	phase := reconcilePhaseSetup
	var (
		swallowedErr   error
		swallowedPhase string
	)
	defer func() {
		switch {
		case err != nil:
			rc.recordReconcileError(phase, err)
		case swallowedErr != nil:
			rc.recordReconcileError(swallowedPhase, swallowedErr)
		}
	}()

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

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
	quotaCondition, err := rc.quotaChecker.RepositoryQuotaConditions(ctx, namespace, newQuota)
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

	hasQuotaChanged := obj.Status.Quota.MaxRepositories != newQuota.MaxRepositories ||
		obj.Status.Quota.MaxResourcesPerRepository != newQuota.MaxResourcesPerRepository

	var shouldGenerateToken bool
	if obj.Spec.Connection != nil && obj.Spec.Connection.Name != "" {
		shouldGenerateToken = rc.shouldGenerateTokenFromConnection(obj)
	}

	shouldRotateWebhookSecret := rc.shouldRotateWebhookSecret(obj)

	// Determine the main triggering condition
	switch {
	// First, we check if the repository is blocked
	case isCurrentlyBlocked && isOverQuota:
		logger.Info("repository blocked and over quota, reconciling but skipping sync")
	case !isCurrentlyBlocked && isOverQuota:
		logger.Info("namespace over quota, blocking repository", "max_repositories", newQuota.MaxRepositories)
	case hasSpecChanged:
		logger.Info("spec changed", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
	case shouldResync:
		logger.Info("sync interval triggered", "sync_interval", time.Duration(obj.Spec.Sync.IntervalSeconds)*time.Second, "sync_status", obj.Status.Sync)
	case shouldCheckHealth:
		logger.Info("health is stale", "health_status", obj.Status.Health.Healthy)
	case forceProcessForUnblock:
		logger.Info("repository was blocked but now within quota, processing to unblock")
	case shouldGenerateToken:
		logger.Info("repository token needs to be generated", "connection", obj.Spec.Connection.Name)
	case hasQuotaChanged:
		logger.Info("quota changed", "quota", newQuota)
	case len(obj.Spec.Workflows) > 0 && repository.GetID(obj.Status.Webhook).IsEmpty():
		logger.Info("webhook missing, reconciling")
	case shouldRotateWebhookSecret:
		logger.Info("webhook secret rotation due")
	default:
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "sync_spec", obj.Spec.Sync)
		return nil
	}

	// In any case - repo blocked, repo unblocked, or simply spec has changed - we need to
	// update the observedGeneration to alight with the given metadata.generation.
	if hasSpecChanged {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": obj.Generation,
		})
	}

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
			if rc.isUserCaused(err) {
				// Swallowed after surfacing on status: stash it so the deferred
				// recorder counts it, since it returns nil to the workqueue.
				patchOperations = append(patchOperations, rc.repositoryFailurePatchOps(obj, err, provisioning.ReasonAuthenticationFailed)...)
				swallowedErr, swallowedPhase = err, reconcilePhaseToken
				logger.Warn("unable to generate repository token, user-caused error", "error", err)
				return repoType, nil
			}

			return repoType, err
		}

		if len(tokenOps) > 0 {
			patchOperations = append(patchOperations, tokenOps...)
		}

		obj.Secure.Token.Create = token
	}

	repo, err := rc.repoFactory.Build(ctx, obj)
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
				if rc.isUserCaused(gerr) {
					patchOperations = append(patchOperations, rc.repositoryFailurePatchOps(obj, gerr, provisioning.ReasonAuthenticationFailed)...)
					swallowedErr, swallowedPhase = gerr, reconcilePhaseToken
					logger.Warn("unable to regenerate repository token, user-caused error", "error", gerr)
					return repoType, nil
				}

				return repoType, fmt.Errorf("regenerating repository token: %w", gerr)
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
			patchOperations = append(patchOperations, rc.repositoryFailurePatchOps(obj, err, classifyBuildFailureReason(err))...)

			if rc.isUserCaused(err) {
				// Swallowed after surfacing on status: stash it so the deferred
				// recorder counts it, since it returns nil to the workqueue.
				swallowedErr, swallowedPhase = err, reconcilePhaseBuild
				logger.Warn("unable to create repository from configuration, user-caused error", "error", err)
				return repoType, nil
			}

			return repoType, fmt.Errorf("unable to create repository from configuration: %w", err)
		}
	}

	// If branch is empty, fetch and set the default branch before running health check
	if branchHandler, ok := repo.(repository.BranchHandler); ok {
		if branchHandler.GetCurrentBranch() == "" {
			logger.Info("given repository branch is empty, getting default branch")

			defaultBranch, err := branchHandler.GetDefaultBranch(ctx)
			if err != nil {
				if errors.Is(err, repository.ErrServerUnavailable) {
					patchOperations = append(patchOperations, rc.repositoryFailurePatchOps(obj, err, classifyBuildFailureReason(err))...)
				}
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

	// Handle health checks using the health checker
	healthResult, err := rc.healthChecker.RefreshHealthWithPatchOps(ctx, repo)
	if err != nil {
		return fmt.Errorf("update health status: %w", err)
	}
	testResults := healthResult.TestResults
	healthStatus := healthResult.HealthStatus

	// If over quota, override health to unhealthy.
	if isOverQuota {
		healthStatus = provisioning.HealthStatus{
			Healthy: false,
			Error:   provisioning.HealthFailureHealth,
			Checked: time.Now().UnixMilli(),
			Message: []string{quotaCondition.Message},
		}
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": healthStatus,
		})
	} else if len(healthResult.PatchOps) > 0 {
		patchOperations = append(patchOperations, healthResult.PatchOps...)
	}

	// Build ALL condition patches together to avoid one overwriting another.
	if conditionPatchOps := BuildConditionPatchOpsFromExisting(
		obj.Status.Conditions, obj.GetGeneration(), quotaCondition, healthResult.ReadyCondition,
	); conditionPatchOps != nil {
		patchOperations = append(patchOperations, conditionPatchOps...)
	}

	// Update fieldErrors from test results - always update to ensure fieldErrors are cleared when there are no errors
	if testResults != nil {
		fieldErrors := testResults.Errors
		if fieldErrors == nil {
			fieldErrors = []provisioning.ErrorDetails{}
		}
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/fieldErrors",
			"value": fieldErrors,
		})
	}

	// determine the sync strategy and sync status to apply
	syncOptions := rc.determineSyncStrategy(ctx, obj, repo, shouldResync, isOverQuota, healthStatus)
	patchOperations = append(patchOperations, rc.determineSyncStatusOps(obj, syncOptions, healthStatus, shouldResync)...)

	// Apply all patch operations
	if len(patchOperations) > 0 {
		err := rc.statusPatcher.Patch(ctx, obj, patchOperations...)
		if err != nil {
			return fmt.Errorf("status patch operations failed: %w", err)
		}
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

// processHooks handles hook execution with intelligent retry logic
// Returns hook operations, whether processing should continue, and any error
func (rc *RepositoryController) processHooks(ctx context.Context, repo repository.Repository, obj *provisioning.Repository) ([]map[string]interface{}, bool, error) {
	webhookMissing := len(obj.Spec.Workflows) > 0 &&
		repository.GetID(obj.Status.Webhook).IsEmpty()

	shouldRunHooks := (obj.Generation != obj.Status.ObservedGeneration) || webhookMissing

	// Suppress the hook retry while the hook-failure cooldown is active, or while
	// the repository just failed its health check (it's known inaccessible, so any
	// create/update/delete call against it is doomed).
	if hasHookChanges && hasWebhookToManage && (isInHookFailureCooldown || !repoAccessible) {
		suppressWebhooks = true
	}

	suppressionMsg := "hooks were not suppressed"
	if suppressWebhooks {
		suppressionMsg = "hooks were suppressed"
	}
	logging.FromContext(ctx).Info(suppressionMsg,
		"hasWebhookToManage", hasWebhookToManage,
		"webhookCapable", webhookCapable,
		"isInHookFailureCooldown", isInHookFailureCooldown,
		"repoAccessible", repoAccessible,
	)

	if hasHookChanges && !suppressWebhooks {
		hookOps, err = rc.runHooks(ctx, repo, obj)
		if err != nil {
			// The failing create/update/delete is why an overdue secret can't be
			// rotated this reconcile, so classify it onto the overdue metric here too
			// -- otherwise a secret stuck behind a persistent hook failure (which
			// keeps hasHookChanges true and returns before the rotation block below)
			// would never record a cause.
			if shouldRotateSecret {
				rc.webhookMetrics.recordRotationOverdue(rc.rotationErrorCause(err))
			}
			status := rc.healthChecker.recordFailure(provisioning.HealthFailureHook, err)
			hookOps = append(hookOps, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/health",
				"value": status,
			})
			return hookOps, &status, false, err
		}
	}

	// Rotate the webhook secret if due, and count it on the overdue metric with
	// the cause it stayed overdue for so alerts can page on a genuine rotation
	// malfunction (cause=system) and ignore user-caused failures (cause=user).
	//
	// Skipped when runHooks already created or updated the webhook this reconcile
	// (len(hookOps) > 0): that path rotates the secret itself, so a second rotation
	// would be redundant and, if it failed, would falsely page. When the repository
	// is inaccessible the rotation call would be as doomed as any other write, so it
	// is skipped too -- but we still know why from the health check, so the overdue
	// observation is classified from the test result (bad credentials/permissions
	// -> user, server unavailable -> system). During the hook-failure cooldown the
	// health check is skipped (repoAccessible reads stale), so nothing is recorded;
	// the reconcile after the cooldown expires classifies it. A rotation that
	// succeeds records nothing.
	if webhookRepo, ok := repo.(repository.WebhookRepository); ok && shouldRotateSecret && len(hookOps) == 0 {
		switch {
		case !repoAccessible:
			rc.webhookMetrics.recordRotationOverdue(classifyOverdueCause(classifyTestResultReason(testResults)))
		case isInHookFailureCooldown:
			// Transient backoff window; the post-cooldown reconcile classifies.
		default:
			rotateCtx, rotateSpan := rc.tracer.Start(ctx, "provisioning.controller.rotate_webhook_secret", repoSpanAttrs(obj))
			rotateOps, rotateErr := rotateWebhookSecret(rotateCtx, webhookRepo)
			rotateSpan.End()
			if rotateErr != nil {
				cause := rc.rotationErrorCause(rotateErr)
				rc.webhookMetrics.recordRotationOverdue(cause)
				logging.FromContext(ctx).Warn("webhook secret rotation failed", "error", rotateErr, "cause", cause)
			}
			if len(rotateOps) > 0 {
				hookOps = append(hookOps, rotateOps...)
			}
		}
	}

	return hookOps, nil, suppressWebhooks, nil
}

// repositoryFailurePatchOps returns patches marking the repository unhealthy
// and Ready=False with the supplied reason, omitting unchanged status.
// The caller applies the patches so the failure can be persisted even when
// reconciliation returns an error to the work queue.
func (rc *RepositoryController) repositoryFailurePatchOps(obj *provisioning.Repository, err error, reason string) []map[string]interface{} {
	healthStatus := provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHealth,
		Checked: time.Now().UnixMilli(),
		Message: []string{err.Error()},
	}
	ops := rc.healthPatchIfChanged(obj, healthStatus)
	readyCondition := buildReadyConditionWithReason(healthStatus, reason)
	return append(ops, BuildConditionPatchOpsFromExisting(
		obj.Status.Conditions, obj.GetGeneration(), readyCondition,
	)...)
}

func (rc *RepositoryController) healthPatchIfChanged(obj *provisioning.Repository, status provisioning.HealthStatus) []map[string]interface{} {
	if !rc.healthChecker.hasHealthStatusChanged(obj.Status.Health, status) {
		return nil
	}

	return []map[string]interface{}{{
		"op":    "replace",
		"path":  "/status/health",
		"value": status,
	}}
}

// recordReconcileError counts a reconcile failure for SLO tracking, classifying
// it as user-caused (the user must fix it, e.g. revoked credentials) or
// system-caused. User-caused failures are surfaced on status and not returned,
// so this metric is how they stay visible; SLOs should alert on cause=system
// and exclude cause=user.
func (rc *RepositoryController) recordReconcileError(phase string, err error) {
	cause := reconcileCauseSystem
	if rc.isUserCaused(err) {
		cause = reconcileCauseUser
	}
	rc.reconcileMetrics.RecordReconcileError(phase, cause)
}

// Returns errors that are due to user errors. Token-generation failures surface
// connection-level sentinels (app uninstalled, permissions revoked, installation
// gone), so classification is shared with the token metric to keep the
// reconcile-error and token-generation-error metrics consistent.
func (rc *RepositoryController) isUserCaused(err error) bool {
	return classifyTokenErrorCause(err) == reconcileCauseUser
}

// classifyBuildFailureReason maps a repository Build failure to a Ready condition
// reason. Build constructs the client and decrypts the repository's secrets after
// the spec has already passed admission validation, so a failure to read that
// secret (decrypt service unreachable, keeper/KMS error) is a transient
// infrastructure issue to retry -- not an invalid configuration for the user to
// fix. Everything else falls back to the shared classification.
func classifyBuildFailureReason(err error) string {
	if errors.Is(err, repository.ErrSecretDecryptFailed) {
		return provisioning.ReasonServiceUnavailable
	}
	return classifyHookFailureReason(err)
}

// rotationErrorCause classifies an error that prevented a webhook secret rotation
// (a rotation attempt or the hook operation blocking it) into an overdue cause.
// User-caused errors (revoked credentials, permissions, app uninstalled) are
// "user"; everything else, including unrecognized errors, defaults to "system" so
// a genuine malfunction pages rather than being silently swallowed.
//
// A 404 (ErrFileNotFound) is treated as "user" to match how the rest of the
// webhook code reads GitHub 404s (createWebhook/updateWebhook): the webhook was
// deleted on the remote, or the token lost access to a private repo (GitHub
// returns 404, not 403, for private repos). Either way it is the customer's to
// resolve, not a system malfunction that should page. rotateWebhookSecret surfaces
// this sentinel raw rather than converting it, so it is matched explicitly here.
func (rc *RepositoryController) rotationErrorCause(err error) string {
	if errors.Is(err, repository.ErrFileNotFound) || rc.isUserCaused(err) {
		return reconcileCauseUser
	}
	return reconcileCauseSystem
}

// classifyOverdueCause maps a Ready condition reason to a webhook-secret rotation
// overdue cause. A transient/infrastructure reason (server unavailable, rate
// limited) is "system" and should page; everything else is the customer's to fix
// (bad credentials, permissions, invalid spec) and is "user".
func classifyOverdueCause(reason string) string {
	switch reason {
	case provisioning.ReasonServiceUnavailable, provisioning.ReasonRateLimited:
		return reconcileCauseSystem
	default:
		return reconcileCauseUser
	}
}

// classifyHookFailureReason maps a hook failure to a Ready condition reason,
// mirroring classifyTestResultReason's approach for health-check failures so
// an auth/permission problem is distinguishable from a generic failure
// instead of always reporting the same reason.
func classifyHookFailureReason(err error) string {
	switch {
	case errors.Is(err, repository.ErrUnauthorized), errors.Is(err, repository.ErrPermissionDenied):
		return provisioning.ReasonAuthenticationFailed
	case errors.Is(err, repository.ErrServerUnavailable), apierrors.IsServiceUnavailable(err):
		return provisioning.ReasonServiceUnavailable
	case errors.Is(err, repository.ErrTooManyRequests):
		return provisioning.ReasonRateLimited
	default:
		return provisioning.ReasonInvalidSpec
	}
}

// isRepositoryAccessible reports whether a failed health check still means the
// repository itself is reachable and its credentials are valid -- i.e. the
// failure is a config/permission gap on an otherwise-usable repository, not a
// loss of access to the git server.
//
// It returns true for a write-permission-denied 403 (reads still work, only the
// write was blocked) and for any status that isn't a definitive access failure.
// It returns false for 401 (bad credentials), 404 (repository gone/hidden), 503
// (server down), and a bare 403 -- the cases where we genuinely cannot reach or
// authenticate to the repository.
func isRepositoryAccessible(testResults *provisioning.TestResults) bool {
	if testResults == nil || testResults.Success {
		return true
	}
	switch testResults.Code {
	case http.StatusForbidden:
		// Couldn't be written to, but the repository was still accessible.
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
