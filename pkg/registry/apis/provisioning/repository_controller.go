package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
)

// RepositoryController controls how and when CRD is established.
type RepositoryController struct {
	client     client.ProvisioningV0alpha1Interface
	repoLister listers.RepositoryLister
	repoSynced cache.InformerSynced

	// Converts config to instance
	repoGetter RepoGetter
	identities auth.BackgroundIdentityService

	// To allow injection for testing.
	syncFn            func(key string) error
	enqueueRepository func(obj any)
	keyFunc           func(obj any) (string, error)

	queue  workqueue.TypedRateLimitingInterface[string]
	logger *slog.Logger
}

// NewRepositoryController creates new RepositoryController.
func NewRepositoryController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	repoInformer informer.RepositoryInformer,
	repoGetter RepoGetter,
	identities auth.BackgroundIdentityService,
) (*RepositoryController, error) {
	rc := &RepositoryController{
		client:     provisioningClient,
		repoLister: repoInformer.Lister(),
		repoSynced: repoInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{
				Name: "provisioningRepositoryController",
			},
		),
		repoGetter: repoGetter,
		identities: identities,
		logger:     slog.Default().With("logger", "provisioning-repository-controller"),
	}

	_, err := repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    rc.addRepository,
		UpdateFunc: rc.updateRepository,
		DeleteFunc: rc.deleteRepository,
	})
	if err != nil {
		return nil, err
	}

	rc.syncFn = rc.sync
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

	rc.logger.Info("Starting RepositoryController")
	defer rc.logger.Info("Shutting down RepositoryController")

	if !cache.WaitForCacheSync(ctx.Done(), rc.repoSynced) {
		return
	}

	rc.logger.Info("Starting workers", "count", workerCount)
	for i := 0; i < workerCount; i++ {
		go wait.UntilWithContext(ctx, rc.runWorker, time.Second)
	}

	rc.logger.Info("Started workers")
	<-ctx.Done()
	rc.logger.Info("Shutting down workers")
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
	rc.queue.Add(key)
}

func (rc *RepositoryController) addRepository(obj interface{}) {
	rc.enqueueRepository(obj)
}

func (rc *RepositoryController) updateRepository(oldObj, newObj interface{}) {
	rc.enqueueRepository(newObj)
}

func (rc *RepositoryController) deleteRepository(obj interface{}) {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		rc.logger.Error("expected a Repository but got %T", obj)
		return
	}
	// TODO: Add job that will remove everything owned by that repository
	rc.logger.Info("TODO, remove everything from repository", "name", repo.Name)
	// rc.enqueueRepository(repo)
}

// processNextWorkItem deals with one key off the queue.
// It returns false when it's time to quit.
func (rc *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	key, quit := rc.queue.Get()
	if quit {
		return false
	}
	defer rc.queue.Done(key)

	rc.logger.Info("RepositoryController processing key", "key", key)

	err := rc.syncFn(key)
	if err == nil {
		rc.queue.Forget(key)
		return true
	}

	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", key, err))
	rc.queue.AddRateLimited(key)

	return true
}

// sync is the business logic of the controller.
func (rc *RepositoryController) sync(key string) error {
	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	cachedRepo, err := rc.repoLister.Repositories(namespace).Get(name)
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	elapsed := now - cachedRepo.Status.Health.Checked
	if time.Duration(elapsed)*time.Millisecond < time.Second*30 {
		// We checked status recently!
		// avoids inf loop!!!
		// This logic is not totally right -- we want to force this if anything in spec changed :thinkign:
		return nil
	}

	// This is used for the health check client
	id, err := rc.identities.WorkerIdentity(context.Background(), namespace)
	if err != nil {
		return err
	}
	ctx := identity.WithRequester(context.Background(), id)

	// Make a copy we can mutate
	cfg := cachedRepo.DeepCopy()
	repo, err := rc.repoGetter.AsRepository(ctx, cfg)
	if err != nil {
		cfg.Status.Health = provisioning.HealthStatus{
			Checked: now,
			Healthy: false,
			Message: []string{
				"Unable to create repository from configuration",
				err.Error(),
			},
		}
	} else {
		res, err := TestRepository(ctx, repo, rc.logger)
		if err != nil {
			res = &provisioning.TestResults{
				Success: false,
				Errors: []string{
					"error running test repository",
					err.Error(),
				},
			}
		}
		cfg.Status.Health = provisioning.HealthStatus{
			Checked: now,
			Healthy: res.Success,
			Message: res.Errors,
		}
	}

	_, err = rc.client.Repositories(cfg.GetNamespace()).
		UpdateStatus(ctx, cfg, metav1.UpdateOptions{})

	if apierrors.IsNotFound(err) || apierrors.IsConflict(err) {
		// deleted or changed in the meantime, we'll get called again
		return nil
	}
	if err != nil {
		return err
	}
	return nil
}
