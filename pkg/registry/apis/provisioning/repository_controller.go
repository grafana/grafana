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
	"k8s.io/klog/v2"

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
	logger     *slog.Logger
	identities auth.BackgroundIdentityService

	// To allow injection for testing.
	syncFn            func(key string) error
	enqueueRepository func(obj any)
	keyFunc           func(obj any) (string, error)

	queue workqueue.TypedRateLimitingInterface[string]
}

// NewRepositoryController creates new RepositoryController.
func NewRepositoryController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	repoInformer informer.RepositoryInformer,
) (*RepositoryController, error) {
	rc := &RepositoryController{
		client:     provisioningClient,
		repoLister: repoInformer.Lister(),
		repoSynced: repoInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "provisioningRepositoryController"},
		),
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
	logger := klog.FromContext(ctx)

	klog.Info("Starting RepositoryController")
	defer klog.Info("Shutting down RepositoryController")

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
	rc.queue.Add(key)
}

func (rc *RepositoryController) addRepository(obj interface{}) {
	rc.enqueueRepository(obj)
}

func (rc *RepositoryController) updateRepository(oldObj, newObj interface{}) {
	rc.enqueueRepository(newObj)
}

func (rc *RepositoryController) deleteRepository(obj interface{}) {
	rc.enqueueRepository(obj)
}

// processNextWorkItem deals with one key off the queue.
// It returns false when it's time to quit.
func (rc *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	logger := klog.FromContext(ctx)
	key, quit := rc.queue.Get()
	if quit {
		return false
	}
	defer rc.queue.Done(key)

	logger.Info("RepositoryController processing key", "key", key)

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
		return err // or update status????
	}

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

	// State should not be empty
	if cfg.Status.Sync.State == "" {
		cfg.Status.Sync.State = provisioning.JobStatePending
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
