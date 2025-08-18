package controller

import (
	"context"
	"encoding/json"
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
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type RepoGetter interface {
	// Given a repository configuration, return it as a repository instance
	// This will only error for un-recoverable system errors
	// the repository instance may or may not be valid/healthy
	AsRepository(ctx context.Context, cfg *provisioning.Repository) (repository.Repository, error)
}

type RepositoryTester interface {
	TestRepository(ctx context.Context, repo repository.Repository) (*provisioning.TestResults, error)
}

const loggerName = "provisioning-repository-controller"

const (
	maxAttempts = 3
)

type queueItem struct {
	key      string
	obj      interface{}
	attempts int
}

// RepositoryController controls how and when CRD is established.
type RepositoryController struct {
	client         client.ProvisioningV0alpha1Interface
	resourceLister resources.ResourceLister
	repoLister     listers.RepositoryLister
	repoSynced     cache.InformerSynced
	parsers        resources.ParserFactory
	logger         logging.Logger
	dualwrite      dualwrite.Service

	jobs      jobs.Queue
	finalizer *finalizer

	// Converts config to instance
	repoGetter RepoGetter
	tester     RepositoryTester
	// To allow injection for testing.
	processFn         func(item *queueItem) error
	enqueueRepository func(obj any)
	keyFunc           func(obj any) (string, error)

	queue workqueue.TypedRateLimitingInterface[*queueItem]
}

// NewRepositoryController creates new RepositoryController.
func NewRepositoryController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	repoInformer informer.RepositoryInformer,
	repoGetter RepoGetter,
	resourceLister resources.ResourceLister,
	parsers resources.ParserFactory,
	clients resources.ClientFactory,
	tester RepositoryTester,
	jobs jobs.Queue,
	dualwrite dualwrite.Service,
) (*RepositoryController, error) {
	rc := &RepositoryController{
		client:         provisioningClient,
		resourceLister: resourceLister,
		repoLister:     repoInformer.Lister(),
		repoSynced:     repoInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*queueItem](),
			workqueue.TypedRateLimitingQueueConfig[*queueItem]{
				Name: "provisioningRepositoryController",
			},
		),
		repoGetter: repoGetter,
		parsers:    parsers,
		finalizer: &finalizer{
			lister:        resourceLister,
			clientFactory: clients,
		},
		tester:    tester,
		jobs:      jobs,
		logger:    logging.DefaultLogger.With("logger", loggerName),
		dualwrite: dualwrite,
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
		repo, err := rc.repoGetter.AsRepository(ctx, obj)
		if err != nil {
			logger.Warn("unable to get repository for cleanup")
		} else {
			err := rc.finalizer.process(ctx, repo, obj.Finalizers)
			if err != nil {
				logger.Warn("error running finalizer", "err")
			}
		}

		// remove the finalizers
		_, err = rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.Name, types.JSONPatchType, []byte(`[
					{ "op": "remove", "path": "/metadata/finalizers" }
				]`), v1.PatchOptions{
				FieldManager: "provisioning-controller",
			})
		return err // delete will be called again
	}

	return nil
}

func (rc *RepositoryController) shouldCheckHealth(obj *provisioning.Repository) bool {
	if obj.Status.Health.Checked == 0 || obj.Generation != obj.Status.ObservedGeneration {
		return true
	}

	healthAge := time.Since(time.UnixMilli(obj.Status.Health.Checked))
	if obj.Status.Health.Healthy {
		return healthAge > time.Minute*5 // when healthy, check every 5 mins
	}

	return healthAge > time.Minute // otherwise within a minute
}

func (rc *RepositoryController) runHealthCheck(ctx context.Context, repo repository.Repository) provisioning.HealthStatus {
	logger := logging.FromContext(ctx)
	logger.Info("running health check")
	res, err := rc.tester.TestRepository(ctx, repo)
	if err != nil {
		res = &provisioning.TestResults{
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Detail: fmt.Sprintf("error running test repository: %s", err.Error()),
			}},
		}
	}

	healthStatus := provisioning.HealthStatus{
		Healthy: res.Success,
		Checked: time.Now().UnixMilli(),
	}
	for _, err := range res.Errors {
		if err.Detail != "" {
			healthStatus.Message = append(healthStatus.Message, err.Detail)
		}
	}

	logger.Info("health check completed", "status", healthStatus)

	return healthStatus
}

func (rc *RepositoryController) shouldResync(obj *provisioning.Repository) bool {
	// don't trigger resync if a sync was never started
	if obj.Status.Sync.Finished == 0 && obj.Status.Sync.State == "" {
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
	case dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, rc.dualwrite):
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

		logger.Info("incremental sync on interval")
		return &provisioning.SyncJobOptions{Incremental: true}
	default:
		return nil
	}
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

func (rc *RepositoryController) patchStatus(ctx context.Context, obj *provisioning.Repository, patchOperations []map[string]interface{}) error {
	if len(patchOperations) == 0 {
		return nil
	}

	patch, err := json.Marshal(patchOperations)
	if err != nil {
		return fmt.Errorf("error encoding status patch: %w", err)
	}

	_, err = rc.client.Repositories(obj.GetNamespace()).
		Patch(ctx, obj.Name, types.JSONPatchType, patch, v1.PatchOptions{}, "status")
	if err != nil {
		return fmt.Errorf("error applying status patch: %w", err)
	}

	return nil
}

func (rc *RepositoryController) determineSyncStatus(obj *provisioning.Repository, syncOptions *provisioning.SyncJobOptions) *provisioning.SyncStatus {
	const unhealthyMessage = "Repository is unhealthy"

	hasUnhealthyMessage := len(obj.Status.Sync.Message) > 0 && obj.Status.Sync.Message[0] == unhealthyMessage
	switch {
	case syncOptions != nil:
		return &provisioning.SyncStatus{
			State:   provisioning.JobStatePending,
			LastRef: obj.Status.Sync.LastRef,
			Started: time.Now().UnixMilli(),
		}
	case obj.Status.Health.Healthy && hasUnhealthyMessage: // if the repository is healthy and the message is set, clear it
		// FIXME: is this the clearest way to do this? Should we introduce another status or way of way of handling more
		// specific errors?
		return &provisioning.SyncStatus{
			LastRef: obj.Status.Sync.LastRef,
		}
	case !obj.Status.Health.Healthy && !hasUnhealthyMessage: // if the repository is unhealthy and the message is not already set, set it
		return &provisioning.SyncStatus{
			State:   provisioning.JobStateError,
			Message: []string{unhealthyMessage},
			LastRef: obj.Status.Sync.LastRef,
		}
	default:
		return nil
	}
}

//nolint:gocyclo
func (rc *RepositoryController) process(item *queueItem) error {
	logger := rc.logger.With("key", item.key)

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

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), namespace)
	if err != nil {
		return err
	}
	ctx = request.WithNamespace(ctx, namespace)
	logger = logger.WithContext(ctx)

	if obj.DeletionTimestamp != nil {
		return rc.handleDelete(ctx, obj)
	}

	shouldResync := rc.shouldResync(obj)
	shouldCheckHealth := rc.shouldCheckHealth(obj)
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration
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
	case shouldResync:
		logger.Info("sync interval triggered", "sync_interval", time.Duration(obj.Spec.Sync.IntervalSeconds)*time.Second, "sync_status", obj.Status.Sync)
	case shouldCheckHealth:
		logger.Info("health is stale", "health_status", obj.Status.Health.Healthy)
	default:
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "sync_spec", obj.Spec.Sync)
		return nil
	}

	repo, err := rc.repoGetter.AsRepository(ctx, obj)
	if err != nil {
		return fmt.Errorf("unable to create repository from configuration: %w", err)
	}

	healthStatus := obj.Status.Health
	if shouldCheckHealth {
		healthStatus = rc.runHealthCheck(ctx, repo)
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": healthStatus,
		})
	}

	// Run hooks
	hookOps, err := rc.runHooks(ctx, repo, obj)
	var hookError error
	switch {
	case err != nil:
		hookError = err
	case len(hookOps) > 0:
		patchOperations = append(patchOperations, hookOps...)
	}

	// If hooks failed, update health status to unhealthy
	if hookError != nil {
		healthStatus = provisioning.HealthStatus{
			Healthy: false,
			Checked: time.Now().UnixMilli(),
			Message: []string{fmt.Sprintf("Hook execution failed: %s", hookError.Error())},
		}
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": healthStatus,
		})
	}

	// determine the sync strategy and sync status to apply
	syncOptions := rc.determineSyncStrategy(ctx, obj, repo, shouldResync, healthStatus)
	if syncStatus := rc.determineSyncStatus(obj, syncOptions); syncStatus != nil {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/sync",
			"value": syncStatus,
		})
	}

	// Apply all patch operations
	if err := rc.patchStatus(ctx, obj, patchOperations); err != nil {
		return err
	}

	// Trigger sync job after we have applied all patch operations
	if syncOptions != nil {
		if err := rc.addSyncJob(ctx, obj, syncOptions); err != nil {
			return err
		}
	}

	return nil
}
