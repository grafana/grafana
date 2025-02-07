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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

	jobs      jobs.JobQueue
	finalizer *finalizer

	// Converts config to instance
	repoGetter RepoGetter
	identities auth.BackgroundIdentityService
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
	identities auth.BackgroundIdentityService,
	tester RepositoryTester,
	jobs jobs.JobQueue,
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
		identities: identities,
		finalizer: &finalizer{
			lister: resourceLister,
			client: parsers.Client,
		},
		tester: tester,
		jobs:   jobs,
		logger: logging.DefaultLogger.With("logger", loggerName),
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

	healthAge := time.Since(time.UnixMilli(obj.Status.Health.Checked))
	syncAge := time.Since(time.UnixMilli(obj.Status.Sync.Finished))
	syncInterval := time.Duration(obj.Spec.Sync.IntervalSeconds) * time.Second
	tolerance := time.Second
	isSyncJobPendingOrRunning := obj.Status.Sync.State == provisioning.JobStatePending || obj.Status.Sync.State == provisioning.JobStateWorking
	shouldResync := syncAge >= (syncInterval-tolerance) && !isSyncJobPendingOrRunning
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration

	if !hasSpecChanged && obj.DeletionTimestamp == nil && (healthAge < time.Hour*4) && !shouldResync {
		logger.Info("skipping as conditions are not met", "status", obj.Status, "generation", obj.Generation, "deletion_timestamp", obj.DeletionTimestamp, "sync_spec", obj.Spec.Sync)
		return nil
	} else {
		logger.Info("conditions met", "status", obj.Status, "generation", obj.Generation, "deletion_timestamp", obj.DeletionTimestamp, "sync_spec", obj.Spec.Sync)
	}

	ctx := context.Background()
	id, err := rc.identities.WorkerIdentity(ctx, namespace)
	if err != nil {
		return err
	}
	ctx = identity.WithRequester(ctx, id)
	logger = logger.WithContext(ctx)

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

	// Test configuration before anything else
	health := obj.Status.Health
	if obj.DeletionTimestamp == nil && healthAge > 200*time.Millisecond {
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

		health = provisioning.HealthStatus{
			Healthy: res.Success,
			Checked: time.Now().UnixMilli(),
			Message: res.Errors,
		}
		patch, err := json.Marshal(map[string]any{
			"status": map[string]any{
				"health": health,
			},
		})
		if err != nil {
			return fmt.Errorf("error encoding health patch: %w", err)
		}

		if _, err := rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.GetName(), types.MergePatchType, patch, v1.PatchOptions{}, "status"); err != nil {
			return fmt.Errorf("update health status: %w", err)
		}
	}

	// Do not continue if provided invalid configuration because sync and hooks won't probably work
	if !health.Healthy {
		logger.Error("repository is unhealthy", "errors", health.Message)
		patch, err := json.Marshal(map[string]any{
			"status": map[string]any{
				"observedGeneration": obj.Generation,
			},
		})
		if err != nil {
			return fmt.Errorf("error encoding health patch: %w", err)
		}

		if _, err := rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.GetName(), types.MergePatchType, patch, v1.PatchOptions{}, "status"); err != nil {
			return fmt.Errorf("update health status: %w", err)
		}

		return nil
	}

	var (
		sync          *provisioning.SyncJobOptions
		webhookStatus *provisioning.WebhookStatus
	)

	switch {
	case obj.Status.ObservedGeneration < 1:
		logger.Info("handle repository create")
		if hooks != nil {
			webhookStatus, err = hooks.OnCreate(ctx)
		}
		sync = &provisioning.SyncJobOptions{}
	case hasSpecChanged:
		logger.Info("handle repository update")
		if hooks != nil {
			webhookStatus, err = hooks.OnUpdate(ctx)
		}
		sync = &provisioning.SyncJobOptions{}
	case shouldResync:
		logger.Info("handle repository resync")
		sync = &provisioning.SyncJobOptions{Incremental: true}
	default:
		logger.Info("handle unknown repository situation")
	}
	if err != nil {
		return fmt.Errorf("error running hooks: %w", err)
	}

	if obj.Spec.Sync.Enabled && sync != nil && obj.Generation > 0 && !isSyncJobPendingOrRunning {
		job, err := rc.jobs.Add(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: obj.Namespace,
			},
			Spec: provisioning.JobSpec{
				Repository: obj.GetName(),
				Action:     provisioning.JobActionSync,
				Sync:       sync,
			},
		})
		if err != nil {
			return fmt.Errorf("error adding sync job: %w", err)
		} else {
			logger.Info("sync job triggered", "job", job.Name)
		}
	}

	if hasSpecChanged {
		patch, err := json.Marshal(map[string]any{
			"status": map[string]any{
				"observedGeneration": obj.Generation,
				"webhook":            webhookStatus,
			},
		})
		if err != nil {
			return fmt.Errorf("error encoding health patch: %w", err)
		}

		if _, err := rc.client.Repositories(obj.GetNamespace()).
			Patch(ctx, obj.GetName(), types.MergePatchType, patch, v1.PatchOptions{}, "status"); err != nil {
			return fmt.Errorf("update health status: %w", err)
		}
	}

	return nil
}
