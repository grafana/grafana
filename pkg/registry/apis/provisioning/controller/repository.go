package controller

import (
	"context"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/prometheus/client_golang/prometheus"
)

const loggerName = "provisioning-repository-controller"

const (
	maxAttempts = 3
)

type queueItem struct {
	key      string
	obj      interface{}
	attempts int
}

//go:generate mockery --name finalizerProcessor --structname MockFinalizerProcessor --inpackage --filename finalizer_mock.go --with-expecter
type finalizerProcessor interface {
	process(ctx context.Context, repo repository.Repository, finalizers []string) error
}

// RepositoryController controls how and when CRD is established.
type RepositoryController struct {
	client     client.ProvisioningV0alpha1Interface
	repoLister listers.RepositoryLister
	repoSynced cache.InformerSynced
	logger     logging.Logger
	dualwrite  dualwrite.Service

	jobs          jobs.Queue
	finalizer     finalizerProcessor
	statusPatcher StatusPatcher

	repoFactory   repository.Factory
	healthChecker *HealthChecker
	// To allow injection for testing.
	processFn         func(item *queueItem) error
	enqueueRepository func(obj any)
	keyFunc           func(obj any) (string, error)

	queue workqueue.TypedRateLimitingInterface[*queueItem]

	registry      prometheus.Registerer
	tracer        tracing.Tracer
	startupTime   time.Time
	startupWindow time.Duration
}

// NewRepositoryController creates new RepositoryController.
func NewRepositoryController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	repoInformer informer.RepositoryInformer,
	repoFactory repository.Factory,
	resourceLister resources.ResourceLister,
	clients resources.ClientFactory,
	jobs jobs.Queue,
	dualwrite dualwrite.Service,
	healthChecker *HealthChecker,
	statusPatcher StatusPatcher,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	parallelOperations int,
) (*RepositoryController, error) {
	finalizerMetrics := registerFinalizerMetrics(registry)

	rc := &RepositoryController{
		client:     provisioningClient,
		repoLister: repoInformer.Lister(),
		repoSynced: repoInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*queueItem](),
			workqueue.TypedRateLimitingQueueConfig[*queueItem]{
				Name: "provisioningRepositoryController",
			},
		),
		repoFactory:   repoFactory,
		healthChecker: healthChecker,
		statusPatcher: statusPatcher,
		finalizer: &finalizer{
			lister:        resourceLister,
			clientFactory: clients,
			metrics:       &finalizerMetrics,
			maxWorkers:    parallelOperations,
		},
		jobs:          jobs,
		logger:        logging.DefaultLogger.With("logger", loggerName),
		dualwrite:     dualwrite,
		registry:      registry,
		tracer:        tracer,
		startupTime:   time.Now(),
		startupWindow: 5 * time.Minute, // Consider syncs stuck if they haven't updated in 5 minutes
	}

	_, err := repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: rc.enqueue,
		UpdateFunc: func(oldObj, newObj interface{}) {
			rc.enqueue(newObj)
		},
	})
	if err != nil {
		return nil, err
	}

	rc.processFn = rc.process
	rc.enqueueRepository = rc.enqueue
	rc.keyFunc = repoKeyFunc

	return rc, nil
}

func repoKeyFunc(obj any) (string, error) {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return "", fmt.Errorf("expected a Repository but got %T", obj)
	}
	return cache.DeletionHandlingMetaNamespaceKeyFunc(repo)
}

// Run starts the RepositoryController.
func (rc *RepositoryController) Run(ctx context.Context, workerCount int) {
	defer utilruntime.HandleCrash()
	defer rc.queue.ShutDown()

	logger := rc.logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting RepositoryController")
	defer logger.Info("Shutting down RepositoryController")

	if !cache.WaitForCacheSync(ctx.Done(), rc.repoSynced) {
		return
	}

	logger.Info("Starting workers", "count", workerCount)
	for i := 0; i < workerCount; i++ {
		go wait.UntilWithContext(ctx, rc.runWorker, time.Second)
	}

	logger.Info("Started workers")
	<-ctx.Done()
	logger.Info("Shutting down workers")
}

func (rc *RepositoryController) runWorker(ctx context.Context) {
	for rc.processNextWorkItem(ctx) {
	}
}

func (rc *RepositoryController) enqueue(obj interface{}) {
	key, err := rc.keyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("couldn't get key for object: %v", err))
		return
	}

	item := queueItem{key: key, obj: obj}
	rc.queue.Add(&item)
}

// processNextWorkItem deals with one key off the queue.
// It returns false when it's time to quit.
func (rc *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	item, quit := rc.queue.Get()
	if quit {
		return false
	}
	defer rc.queue.Done(item)

	// TODO: should we move tracking work to trace ids instead?
	logger := logging.FromContext(ctx).With("work_key", item.key)
	logger.Info("RepositoryController processing key")

	err := rc.processFn(item)
	if err == nil {
		rc.queue.Forget(item)
		return true
	}

	item.attempts++
	logger = logger.With("error", err, "attempts", item.attempts)
	logger.Error("RepositoryController failed to process key")

	if item.attempts >= maxAttempts {
		logger.Error("RepositoryController failed too many times")
		rc.queue.Forget(item)
		return true
	}

	if !apierrors.IsServiceUnavailable(err) {
		logger.Info("RepositoryController will not retry")
		rc.queue.Forget(item)
		return true
	} else {
		logger.Info("RepositoryController will retry as service is unavailable")
	}

	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", item, err))
	rc.queue.AddRateLimited(item)

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

		// remove the finalizers
		_, err = rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.Name, types.JSONPatchType, []byte(`[
					{ "op": "remove", "path": "/metadata/finalizers" }
				]`), v1.PatchOptions{
				FieldManager: "provisioning-controller",
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

func (rc *RepositoryController) shouldResync(obj *provisioning.Repository) bool {
	// don't trigger resync if a sync was never started
	if obj.Status.Sync.State == "" {
		return false
	}

	syncAge := time.Since(time.UnixMilli(obj.Status.Sync.Finished))
	syncInterval := time.Duration(obj.Spec.Sync.IntervalSeconds) * time.Second
	tolerance := time.Second

	// HACK: how would this work in a multi-tenant world or under heavy load?
	// It will start queueing up jobs and we will have to deal with that
	pendingForTooLong := syncAge >= syncInterval/2 && obj.Status.Sync.State == provisioning.JobStatePending
	isRunning := obj.Status.Sync.State == provisioning.JobStateWorking

	return obj.Spec.Sync.Enabled && syncAge >= (syncInterval-tolerance) && !pendingForTooLong && !isRunning
}

// hasActiveJob checks if there's an active (claimed/leased) job for the given repository.
// A job is considered active if it has the claim label, meaning a worker currently holds a lease on it.
func (rc *RepositoryController) hasActiveJob(ctx context.Context, namespace, repoName string) (bool, error) {
	// Set up the provisioning identity for this namespace
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return false, fmt.Errorf("failed to get provisioning identity for '%s': %w", namespace, err)
	}

	// Build label selector: must have both repository label and claim label (exists)
	// Using the same approach as persistentStore.Claim but with additional repository filter
	selector := fmt.Sprintf("%s=%s,%s", jobs.LabelRepository, repoName, jobs.LabelJobClaim)

	jobList, err := rc.client.Jobs(namespace).List(ctx, v1.ListOptions{
		LabelSelector: selector,
		Limit:         1, // We only need to know if at least one exists
	})
	if err != nil {
		return false, fmt.Errorf("failed to list jobs: %w", err)
	}

	return len(jobList.Items) > 0, nil
}

// isSyncStuck detects if a repository's sync state appears to be stuck from a previous crash or restart.
// This only applies during the startup window and verifies there's no active job in the queue.
func (rc *RepositoryController) isSyncStuck(ctx context.Context, obj *provisioning.Repository) (bool, error) {
	// Only check for stuck syncs during startup window
	if time.Since(rc.startupTime) > rc.startupWindow {
		return false, nil
	}

	// Check if the repository is in a potentially stuck state
	if obj.Status.Sync.State != provisioning.JobStatePending && obj.Status.Sync.State != provisioning.JobStateWorking {
		return false, nil
	}

	// If the sync started before this controller started, it might be from a previous run
	if obj.Status.Sync.Started > 0 {
		startedAt := time.UnixMilli(obj.Status.Sync.Started)
		if !startedAt.Before(rc.startupTime) {
			// Sync started after this controller started, so it's legitimate
			return false, nil
		}
	}

	// Check if there's an active job for this repository
	hasActiveJob, err := rc.hasActiveJob(ctx, obj.Namespace, obj.Name)
	if err != nil {
		return false, fmt.Errorf("failed to check for active job: %w", err)
	}

	// If there's an active job with a valid lease, the sync is not stuck
	return !hasActiveJob, nil
}

func (rc *RepositoryController) runHooks(ctx context.Context, repo repository.Repository, obj *provisioning.Repository) ([]map[string]interface{}, error) {
	logger := logging.FromContext(ctx)
	hooks, _ := repo.(repository.Hooks)
	if hooks == nil {
		return nil, nil
	}

	if obj.Status.ObservedGeneration < 1 {
		logger.Info("handle repository create")
		patchOperations, err := hooks.OnCreate(ctx)
		if err != nil {
			return nil, fmt.Errorf("error running OnCreate: %w", err)
		}
		return patchOperations, nil
	}

	logger.Info("handle repository spec update", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
	patchOperations, err := hooks.OnUpdate(ctx)
	if err != nil {
		return nil, fmt.Errorf("error running OnUpdate: %w", err)
	}

	return patchOperations, nil
}

func (rc *RepositoryController) determineSyncStrategy(ctx context.Context, obj *provisioning.Repository, repo repository.Repository, shouldResync bool, healthStatus provisioning.HealthStatus) *provisioning.SyncJobOptions {
	logger := logging.FromContext(ctx)

	switch {
	case !obj.Spec.Sync.Enabled:
		logger.Info("skip sync as it's disabled")
		return nil
	case !healthStatus.Healthy:
		logger.Info("skip sync for unhealthy repository")
		return nil
	case rc.dualwrite != nil && dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, rc.dualwrite):
		logger.Info("skip sync as we are reading from legacy storage")
		return nil
	case healthStatus.Healthy != obj.Status.Health.Healthy:
		logger.Info("repository became healthy, full resync")
		return &provisioning.SyncJobOptions{}
	case obj.Status.ObservedGeneration < 1:
		logger.Info("full sync for new repository")
		return &provisioning.SyncJobOptions{}
	case obj.Generation != obj.Status.ObservedGeneration:
		logger.Info("full sync for spec change")
		return &provisioning.SyncJobOptions{}
	case shouldResync:
		// Continue to see if we could skip for other reasons
		versioned, ok := repo.(repository.Versioned)
		// If the repository is not versioned, we don't have a way to check for incremental updates
		if !ok {
			logger.Info("full sync on interval for non-versioned repository")
			return &provisioning.SyncJobOptions{}
		}
		latestRef, err := versioned.LatestRef(ctx)
		if err != nil {
			logger.Warn("incremental sync on interval without knowing if ref has actually changed", "error", err)
			return &provisioning.SyncJobOptions{Incremental: true}
		}

		// Only resync if the latest ref is different from the last synced ref
		if latestRef == obj.Status.Sync.LastRef {
			logger.Info("skip incremental sync as reference is the same")
			return nil
		}

		// Whenever possible, we try to keep it as an incremental sync to keep things performant.
		// However, if there are any .keep file deletions inside a folder with no other deletions, we need
		// to do a full sync to see if the folder was deleted as well in git.
		incremental, err := shouldUseIncrementalSync(ctx, versioned, obj, latestRef)
		if err != nil {
			logger.Warn("unable to compare files for incremental sync, doing full sync", "error", err)
			return &provisioning.SyncJobOptions{}
		}

		logger.Info("sync on interval", "incremental", incremental)
		return &provisioning.SyncJobOptions{Incremental: incremental}
	default:
		return nil
	}
}

func shouldUseIncrementalSync(ctx context.Context, versioned repository.Versioned, obj *provisioning.Repository, latestRef string) (bool, error) {
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

	return repository.CanUseIncrementalSync(deletedPaths), nil
}

func (rc *RepositoryController) addSyncJob(ctx context.Context, obj *provisioning.Repository, syncOptions *provisioning.SyncJobOptions) error {
	job, err := rc.jobs.Insert(ctx, obj.Namespace, provisioning.JobSpec{
		Repository: obj.GetName(),
		Action:     provisioning.JobActionPull,
		Pull:       syncOptions,
	})
	if apierrors.IsAlreadyExists(err) {
		logging.FromContext(ctx).Info("sync job already exists, nothing triggered")
		return nil
	}
	if err != nil {
		// FIXME: should we update the status of the repository if we fail to add the job?
		return fmt.Errorf("error adding sync job: %w", err)
	}

	logging.FromContext(ctx).Info("sync job triggered", "job", job.Name)
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

//nolint:gocyclo
func (rc *RepositoryController) process(item *queueItem) error {
	logger := rc.logger.With("key", item.key)
	ctx := logging.Context(context.Background(), logger)

	namespace, name, err := cache.SplitMetaNamespaceKey(item.key)
	if err != nil {
		return err
	}

	obj, err := rc.repoLister.Repositories(namespace).Get(name)
	switch {
	case apierrors.IsNotFound(err):
		return errors.New("repository not found in cache")
	case err != nil:
		return err
	}

	ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return err
	}
	ctx = request.WithNamespace(ctx, namespace)
	logger = logger.WithContext(ctx)

	if obj.DeletionTimestamp != nil {
		return rc.handleDelete(ctx, obj)
	}

	shouldResync := rc.shouldResync(obj)
	shouldCheckHealth := rc.healthChecker.ShouldCheckHealth(obj)
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration
	isStuckSync, err := rc.isSyncStuck(ctx, obj)
	if err != nil {
		return fmt.Errorf("failed to check if sync is stuck: %w", err)
	}
	patchOperations := []map[string]interface{}{}

	// Determine the main triggering condition
	switch {
	case hasSpecChanged:
		logger.Info("spec changed", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": obj.Generation,
		})
	case isStuckSync:
		logger.Info("detected stuck sync from previous run, will trigger recovery sync", "sync_state", obj.Status.Sync.State, "started", obj.Status.Sync.Started)
	case shouldResync:
		logger.Info("sync interval triggered", "sync_interval", time.Duration(obj.Spec.Sync.IntervalSeconds)*time.Second, "sync_status", obj.Status.Sync)
	case shouldCheckHealth:
		logger.Info("health is stale", "health_status", obj.Status.Health.Healthy)
	default:
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "sync_spec", obj.Spec.Sync)
		return nil
	}

	repo, err := rc.repoFactory.Build(ctx, obj)
	if err != nil {
		return fmt.Errorf("unable to create repository from configuration: %w", err)
	}

	// Handle hooks - may return early if hooks fail
	hookOps, shouldContinue, err := rc.processHooks(ctx, repo, obj)
	if err != nil {
		return fmt.Errorf("process hooks: %w", err)
	}
	if !shouldContinue {
		return nil // Hook handling already updated status and returned early
	}
	if len(hookOps) > 0 {
		patchOperations = append(patchOperations, hookOps...)
	}

	// Handle health checks using the health checker
	_, healthStatus, err := rc.healthChecker.RefreshHealth(ctx, repo)
	if err != nil {
		return fmt.Errorf("update health status: %w", err)
	}

	// Handle stuck sync recovery - force a new sync regardless of other conditions
	var syncOptions *provisioning.SyncJobOptions
	if isStuckSync {
		if obj.Spec.Sync.Enabled {
			logger.Info("forcing full sync to recover from stuck state")
			syncOptions = &provisioning.SyncJobOptions{}
		}
	} else {
		// determine the sync strategy and sync status to apply normally
		syncOptions = rc.determineSyncStrategy(ctx, obj, repo, shouldResync, healthStatus)
	}

	patchOperations = append(patchOperations, rc.determineSyncStatusOps(obj, syncOptions, healthStatus)...)

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
	shouldRunHooks := obj.Generation != obj.Status.ObservedGeneration

	// Skip hooks if status already indicates recent hook failure to avoid infinite retry
	if shouldRunHooks && rc.healthChecker.HasRecentFailure(obj.Status.Health, provisioning.HealthFailureHook) {
		shouldRunHooks = false
	}

	if !shouldRunHooks {
		return nil, true, nil
	}

	hookOps, err := rc.runHooks(ctx, repo, obj)
	if err != nil {
		if err := rc.healthChecker.RecordFailure(ctx, provisioning.HealthFailureHook, err, obj); err != nil {
			return nil, false, fmt.Errorf("update status after hook failure: %w", err)
		}

		return nil, false, err
	}

	return hookOps, true, nil
}
