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

type operation int

const (
	operationCreate operation = iota
	operationUpdate
	operationDelete
)

const maxAttempts = 3

type queueItem struct {
	key      string
	op       operation
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

	jobs jobs.JobQueue

	// Converts config to instance
	repoGetter RepoGetter
	identities auth.BackgroundIdentityService
	tester     *RepositoryTester

	// To allow injection for testing.
	processFn         func(item *queueItem) error
	enqueueRepository func(op operation, obj any)
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
		tester:     tester,
		jobs:       jobs,
		logger:     logging.DefaultLogger.With("logger", loggerName),
	}

	_, err := repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    rc.addRepository,
		UpdateFunc: rc.updateRepository,
		DeleteFunc: rc.deleteRepository,
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

func (rc *RepositoryController) enqueue(op operation, obj interface{}) {
	key, err := rc.keyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("couldn't get key for object: %v", err))
		return
	}

	item := queueItem{key: key, obj: obj, op: op}
	rc.queue.Add(&item)
}

func (rc *RepositoryController) addRepository(obj interface{}) {
	rc.enqueueRepository(operationCreate, obj)
}

func (rc *RepositoryController) updateRepository(oldObj, newObj interface{}) {
	rc.enqueueRepository(operationUpdate, newObj)
}

func (rc *RepositoryController) deleteRepository(obj interface{}) {
	rc.enqueueRepository(operationDelete, obj)
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
	hasSpecChanged := obj.Generation != obj.Status.ObservedGeneration
	if !hasSpecChanged && obj.DeletionTimestamp == nil && (healthAge < time.Hour*4) {
		logger.Info("repository spec unchanged")
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
	hooks, _ := repo.(repository.RepositoryHooks)
	status := &obj.Status
	var sync *provisioning.SyncOptions

	switch {
	// Delete
	case obj.DeletionTimestamp != nil:
		logger.Info("handle repository delete")
		if hooks != nil {
			// FIXME... this should be converted to a "remove-webhook" finalizer
			eee := hooks.OnDelete(ctx)
			if eee != nil {
				logger.Warn("Error running deletion hooks", "err", err)
			}
		}

		// Process any finalizers
		if len(obj.Finalizers) > 0 {
			for _, finalizer := range obj.Finalizers {
				switch finalizer {
				case "cleanup":
					logger.Info("handle cleanup")

					parser, err := rc.parsers.GetParser(ctx, repo)
					if err != nil {
						return fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
					}
					replicator, err := jobs.NewSyncer(repo, rc.resourceLister, parser)
					if err != nil {
						return fmt.Errorf("error creating replicator")
					}
					if err := replicator.DeleteAllProvisionedResources(ctx); err != nil {
						return fmt.Errorf("unsync repository: %w", err)
					}

				default:
					logger.Warn("unknown finalizer: " + finalizer)
				}
			}

			// remove the finalizers
			_, err = rc.client.Repositories(obj.GetNamespace()).
				Patch(ctx, obj.Name, types.JSONPatchType, []byte(`[
						{ "op": "remove", "path": "/metadata/finalizers" }
					]`), v1.PatchOptions{
					FieldManager: "repository-controller",
				})
			return err // delete will be called again
		}

	// Create
	case obj.Status.ObservedGeneration < 1:
		logger.Info("handle repository create")
		if hooks != nil {
			status, err = hooks.OnCreate(ctx)
		}
		sync = &provisioning.SyncOptions{Complete: true}

	// Update
	default:
		logger.Info("handle repository update")
		if hooks != nil {
			status, err = hooks.OnUpdate(ctx)
		}
		sync = &provisioning.SyncOptions{
			Complete: hasSpecChanged,
		}
	}
	if err != nil {
		return err
	}

	healthAge = time.Since(time.UnixMilli(status.Health.Checked))
	status.ObservedGeneration = obj.Generation
	if obj.DeletionTimestamp == nil && healthAge > 200*time.Millisecond {
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
	}

	// Queue a sync job
	hash := status.Sync.Hash
	if status.Sync.State == provisioning.JobStateWorking {
		res := rc.jobs.Status(ctx, obj.Namespace, status.Sync.JobID)
		if res == nil {
			logger.Warn("error getting job status", "job", status.Sync.JobID)
			res = &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"unable to find status for job: " + status.Sync.JobID},
			}
		}
		status.Sync = res.ToSyncStatus(status.Sync.JobID)
	}

	// Maybe add a new sync job
	if status.Health.Healthy && sync != nil && status.Sync.State != provisioning.JobStateWorking {
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
			logger.Error("error adding sync job", "error", err)
			status.Sync = provisioning.SyncStatus{
				State:   provisioning.JobStateError,
				Started: time.Now().UnixMilli(),
				Message: []string{
					"Error starting sync job",
					err.Error(),
				},
			}
		} else {
			status.Sync = job.Status.ToSyncStatus(job.Name)
			logger.Info("sync job triggered", "job", job.Name)
		}
	}
	status.Sync.Hash = hash
	obj.Status = *status

	// Write the updated status (careful not to trigger inf loop)
	if _, err := rc.client.Repositories(obj.GetNamespace()).
		UpdateStatus(ctx, obj, v1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	return nil
}
