package controller

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informerv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

type RepositoryController struct {
	client     typedclient.ProvisioningV0alpha1Interface
	repoLister listers.RepositoryLister
	repoSynced cache.InformerSynced
	logger     logging.Logger
	queue      workqueue.TypedRateLimitingInterface[string]
}

func NewRepositoryController(
	provisioningClient typedclient.ProvisioningV0alpha1Interface,
	repoInformer informerv0alpha1.RepositoryInformer,
) (*RepositoryController, error) {
	controller := &RepositoryController{
		client:     provisioningClient,
		repoLister: repoInformer.Lister(),
		repoSynced: repoInformer.Informer().HasSynced,
		logger: logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})),
		queue: workqueue.NewTypedRateLimitingQueue[string](workqueue.DefaultTypedControllerRateLimiter[string]()),
	}

	_, err := repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: controller.enqueue,
		UpdateFunc: func(oldObj, newObj interface{}) {
			controller.enqueue(newObj)
		},
		DeleteFunc: controller.enqueue,
	})
	if err != nil {
		return nil, err
	}

	return controller, nil
}

func (c *RepositoryController) Run(ctx context.Context) {
	defer c.queue.ShutDown()

	if !cache.WaitForCacheSync(ctx.Done(), c.repoSynced) {
		c.logger.Error("Failed to sync informer cache")
		return
	}

	go func() {
		wait.UntilWithContext(ctx, c.runWorker, time.Second)
		c.logger.Info("Worker stopped")
	}()

	<-ctx.Done()
}

func (c *RepositoryController) enqueue(obj interface{}) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		c.logger.Error("Couldn't get key for object", "error", err)
		return
	}
	switch repo := obj.(type) {
	case *provisioning.Repository:
		var eventType string
		if repo.DeletionTimestamp != nil {
			eventType = "delete"
		} else {
			eventType = "add/update"
		}
		c.logger.Debug("Received repository event",
			"event_type", eventType,
			"key", key,
			"namespace", repo.Namespace,
			"name", repo.Name,
			"generation", repo.Generation)
	}

	c.queue.Add(key)
}

func (c *RepositoryController) runWorker(ctx context.Context) {
	for c.processNextWorkItem(ctx) {
	}
}

func (c *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	key, quit := c.queue.Get()
	if quit {
		return false
	}
	defer c.queue.Done(key)

	logger := c.logger.With("key", key)
	logger.Debug("Processing work item from queue")

	err := c.processRepository(ctx, key)
	if err == nil {
		c.queue.Forget(key)
		logger.Debug("Successfully processed work item")
		return true
	}

	logger.Error("Failed to process repository", "error", err)
	c.queue.AddRateLimited(key)
	return true
}

func (c *RepositoryController) processRepository(ctx context.Context, key string) error {
	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	repo, err := c.repoLister.Repositories(namespace).Get(name)
	if err != nil {
		return err
	}
	c.logger.Debug("Processing repository",
		"namespace", repo.Namespace,
		"name", repo.Name,
		"type", repo.Spec.Type,
		"generation", repo.Generation,
		"observedGeneration", repo.Status.ObservedGeneration)

	if repo.Generation != repo.Status.ObservedGeneration {
		repo.Status.ObservedGeneration = repo.Generation

		_, err = c.client.Repositories(repo.Namespace).UpdateStatus(ctx, repo, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		// TODO: do a lot more here :)
		c.logger.Debug("Updated repository status",
			"namespace", repo.Namespace,
			"name", repo.Name,
			"observedGeneration", repo.Status.ObservedGeneration)
	}

	return nil
}
