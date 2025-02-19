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
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
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
	parsers        *resources.ParserFactory
	logger         logging.Logger
	secrets        secrets.Service

	jobs      jobs.JobQueue
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
	parsers *resources.ParserFactory,
	tester RepositoryTester,
	jobs jobs.JobQueue,
	secrets secrets.Service,
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
			lister: resourceLister,
			client: parsers.Client,
		},
		tester:  tester,
		jobs:    jobs,
		logger:  logging.DefaultLogger.With("logger", loggerName),
		secrets: secrets,
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

	ctx, _, err := identity.WithProvisioningIdentitiy(context.Background(), namespace)
	if err != nil {
		return err
	}
	logger = logger.WithContext(ctx)

	healthAge := time.Since(time.UnixMilli(obj.Status.Health.Checked))
	syncAge := time.Since(time.UnixMilli(obj.Status.Sync.Finished))
	syncInterval := time.Duration(obj.Spec.Sync.IntervalSeconds) * time.Second
	tolerance := time.Second
	// HACK: how would this work in a multi-tenant world or under heavy load?
	// It will start queueing up jobs and we will have to deal with that
	pendingForTooLong := syncAge >= syncInterval/2 && obj.Status.Sync.State == provisioning.JobStatePending
	isRunning := obj.Status.Sync.State == provisioning.JobStateWorking
	shouldResync := syncAge >= (syncInterval-tolerance) && !pendingForTooLong && !isRunning
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration

	switch {
	case hasSpecChanged:
		logger.Info("spec changed", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
	case obj.DeletionTimestamp != nil:
		logger.Info("deletion timestamp set")
	case shouldResync:
		logger.Info("sync interval triggered", "sync_age", syncAge, "sync_interval", syncInterval, "sync_status", obj.Status.Sync.State)
		// Force health check on resync
		healthAge = time.Hour // Force health check to run
	case healthAge > time.Hour*4:
		logger.Info("health is too old", "health_age", healthAge)
	default:
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "deletion_timestamp", obj.DeletionTimestamp, "sync_spec", obj.Spec.Sync)
		return nil
	}

	repo, err := rc.repoGetter.AsRepository(ctx, obj)
	if err != nil {
		return fmt.Errorf("unable to create repository from configuration: %w", err)
	}

	// Safe to edit the repository from here
	obj = obj.DeepCopy()
	hooks, _ := repo.(repository.RepositoryHooks)

	if obj.DeletionTimestamp != nil {
		logger.Info("handle repository delete")

		// Process any finalizers
		if len(obj.Finalizers) > 0 {
			err = rc.finalizer.process(ctx, repo, obj.Finalizers)
			if err != nil {
				return fmt.Errorf("error running finalizers %w", err)
			}

			// remove the finalizers
			_, err = rc.client.Repositories(obj.GetNamespace()).
				Patch(ctx, obj.Name, types.JSONPatchType, []byte(`[
						{ "op": "remove", "path": "/metadata/finalizers" }
					]`), v1.PatchOptions{
					FieldManager: "repository-controller",
				})
		}

		return err // delete will be called again
	}

	// Initialize patch operations
	patchOperations := []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": obj.Generation,
		},
	}

	if obj.DeletionTimestamp == nil && healthAge > 350*time.Millisecond {
		logger.Info("running health check")
		res, err := rc.tester.TestRepository(ctx, repo)
		if err != nil {
			res = &provisioning.TestResults{
				Success: false,
				Errors: []string{
					"error running test repository",
					err.Error(),
				},
			}
		}

		// Create timestamp once and use it consistently
		now := time.Now().UnixMilli()
		healthStatus := provisioning.HealthStatus{
			Healthy: res.Success,
			Checked: now,
			Message: res.Errors,
		}

		// Add health status patch operation
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/health",
			"value": healthStatus,
		})

		// If health check fails, add sync state patch operation
		if !res.Success {
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":   "replace",
				"path": "/status/sync",
				"value": provisioning.SyncStatus{
					State:   provisioning.JobStateError,
					Message: res.Errors,
				},
			})
		}

		logger.Info("health check completed",
			"healthy", res.Success,
			"checked", now,
			"errors", len(res.Errors))
	}

	var incremental bool
	switch {
	case obj.Status.ObservedGeneration < 1:
		logger.Info("handle repository create")
		if hooks != nil {
			webhookStatus, err := hooks.OnCreate(ctx)
			if err != nil {
				return fmt.Errorf("error running OnCreate: %w", err)
			}
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/webhook",
				"value": webhookStatus,
			})
		}
	case hasSpecChanged:
		logger.Info("handle repository spec update", "Generation", obj.Generation, "ObservedGeneration", obj.Status.ObservedGeneration)
		if hooks != nil {
			webhookStatus, err := hooks.OnUpdate(ctx)
			if err != nil {
				return fmt.Errorf("error running OnCreate: %w", err)
			}
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/webhook",
				"value": webhookStatus,
			})
		}
	case shouldResync:
		logger.Info("handle repository resync")
		incremental = true
	default:
		return errors.New("unknown repository situation")
	}

	if obj.Spec.Sync.Enabled && obj.Status.Health.Healthy {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":   "replace",
			"path": "/status/sync",
			"value": provisioning.SyncStatus{
				State: provisioning.JobStatePending,
			},
		})
	}

	// Apply all collected patch operations if we have any
	if len(patchOperations) > 0 {
		patch, err := json.Marshal(patchOperations)
		if err != nil {
			return fmt.Errorf("error encoding status patch: %w", err)
		}

		_, err = rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.Name, types.JSONPatchType, patch, v1.PatchOptions{}, "status")
		if err != nil {
			return fmt.Errorf("error applying status patch: %w", err)
		}
	}

	// Trigger sync job after we have applied all patch operations
	if obj.Spec.Sync.Enabled && obj.Status.Health.Healthy {
		job, err := rc.jobs.Add(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: obj.Namespace,
			},
			Spec: provisioning.JobSpec{
				Repository: obj.GetName(),
				Action:     provisioning.JobActionSync,
				Sync:       &provisioning.SyncJobOptions{Incremental: incremental},
			},
		})
		if err != nil {
			return fmt.Errorf("error adding sync job: %w", err)
		}

		logger.Info("sync job triggered", "job", job.Name)
	}

	return nil
}
