package provisioning

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

const loggerName = "provisioning-repository-controller"

const maxAttempts = 3

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
	tester     *RepositoryTester

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
	tester *RepositoryTester,
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
	interval := time.Duration(obj.Spec.Sync.IntervalSeconds) * time.Second
	tolerance := 2 * time.Second
	isStale := healthAge > interval+tolerance

	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration
	isFirstTime := obj.Status.ObservedGeneration == 0
	isDelete := obj.DeletionTimestamp != nil

	if !hasSpecChanged && !isDelete && !isFirstTime && !isStale {
		logger.Info("skip processing as conditions are not met", "stale", isStale, "spec_changed", hasSpecChanged)
		return nil
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
	hooks, hasHooks := repo.(repository.RepositoryHooks)

	status := &obj.Status
	status.ObservedGeneration = obj.Generation

	// Delete (note this switch does not fallthrough to the health check)
	if isDelete {
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
			if err != nil {
				return fmt.Errorf("remove finalizers: %w", err)
			}
		}

		return nil
	}

	if !hasHooks && !isStale && !hasSpecChanged {
		logger.Info("no hooks, stale, or spec changed, skip processing", "has_hooks", hasHooks, "stale", isStale, "spec_changed", hasSpecChanged)
		return nil
	}

	// Execute hooks
	if isFirstTime && hasHooks {
		logger.Info("handle repository create")
		status, err = hooks.OnCreate(ctx)
		if err != nil {
			return fmt.Errorf("execute on create: %w", err)
		}
	} else if hasSpecChanged && hasHooks {
		logger.Info("handle repository update")
		status, err = hooks.OnUpdate(ctx)
		if err != nil {
			return fmt.Errorf("execute on create: %w", err)
		}
	} else {
		logger.Info("handle only repository reconciliation")
	}

	// Trigger health check if it didn't run recently
	if isStale || hasSpecChanged {
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

		status.Health = provisioning.HealthStatus{
			Healthy: res.Success,
			Checked: time.Now().UnixMilli(),
			Message: res.Errors,
		}
		if !res.Success {
			logger.Error("repository is unhealthy", "errors", res.Errors)
		}

		// Trigger sync if needed
		switch {
		case !status.Health.Healthy:
			logger.Info("sync job not triggered as repository is unhealthy")
		case !obj.Spec.Sync.Enabled:
			logger.Info("sync job not triggered as sync is disabled")
		case status.Sync.State == provisioning.JobStateWorking:
			logger.Info("sync job not triggered as it is already running")
		default:
			job, err := rc.jobs.Add(ctx, &provisioning.Job{
				ObjectMeta: v1.ObjectMeta{
					Namespace: obj.GetNamespace(),
				},
				Spec: provisioning.JobSpec{
					Repository: obj.GetName(),
					Action:     provisioning.JobActionSync,
					Sync: &provisioning.SyncJobOptions{
						// Execute complete sync if repository is new or spec changed
						Complete: status.ObservedGeneration < 1 || hasSpecChanged,
					},
				},
			})
			if err != nil {
				logger.Error("error adding sync job", "error", err)
				status.Sync = provisioning.SyncStatus{
					State:   provisioning.JobStateError,
					Started: time.Now().UnixMilli(),
					Message: []string{"Error starting sync job", err.Error()},
				}
			}
			logger.Info("sync job triggered", "job", job.Name)
		}
	}

	obj.Status = *status
	// Write the updated status (careful not to trigger inf loop)
	if _, err := rc.client.Repositories(obj.GetNamespace()).
		UpdateStatus(ctx, obj, v1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	return nil
}
