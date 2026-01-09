package controller

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	connectionvalidation "github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"k8s.io/apimachinery/pkg/fields"
)

const connectionLoggerName = "provisioning-connection-controller"

const (
	connectionMaxAttempts = 3
	// connectionHealthyDuration defines how recent a health check must be to be considered "recent" when healthy
	connectionHealthyDuration = 5 * time.Minute
	// connectionUnhealthyDuration defines how recent a health check must be to be considered "recent" when unhealthy
	connectionUnhealthyDuration = 1 * time.Minute
)

type connectionQueueItem struct {
	key      string
	attempts int
}

// ConnectionStatusPatcher defines the interface for updating connection status.
//
//go:generate mockery --name=ConnectionStatusPatcher
type ConnectionStatusPatcher interface {
	Patch(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) error
}

// RepositoryLister interface for listing repositories
type RepositoryLister interface {
	List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

// ConnectionController controls Connection resources.
type ConnectionController struct {
	client     client.ProvisioningV0alpha1Interface
	connLister listers.ConnectionLister
	connSynced cache.InformerSynced
	logger     logging.Logger

	statusPatcher ConnectionStatusPatcher
	repoLister    RepositoryLister

	queue workqueue.TypedRateLimitingInterface[*connectionQueueItem]
}

// NewConnectionController creates a new ConnectionController.
func NewConnectionController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	connInformer informer.ConnectionInformer,
	statusPatcher ConnectionStatusPatcher,
	repoLister RepositoryLister,
) (*ConnectionController, error) {
	cc := &ConnectionController{
		client:     provisioningClient,
		connLister: connInformer.Lister(),
		connSynced: connInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
			workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{
				Name: "provisioningConnectionController",
			},
		),
		statusPatcher: statusPatcher,
		repoLister:    repoLister,
		logger:        logging.DefaultLogger.With("logger", connectionLoggerName),
	}

	_, err := connInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: cc.enqueue,
		UpdateFunc: func(oldObj, newObj interface{}) {
			cc.enqueue(newObj)
		},
	})
	if err != nil {
		return nil, err
	}

	return cc, nil
}

func (cc *ConnectionController) enqueue(obj interface{}) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		cc.logger.Error("failed to get key for object", "error", err)
		return
	}
	cc.queue.Add(&connectionQueueItem{key: key})
}

// Run starts the ConnectionController.
func (cc *ConnectionController) Run(ctx context.Context, workerCount int) {
	defer utilruntime.HandleCrash()
	defer cc.queue.ShutDown()

	cc.logger.Info("starting connection controller", "workers", workerCount)

	for i := 0; i < workerCount; i++ {
		go wait.UntilWithContext(ctx, cc.runWorker, time.Second)
	}

	<-ctx.Done()
	cc.logger.Info("shutting down connection controller")
}

func (cc *ConnectionController) runWorker(ctx context.Context) {
	for cc.processNextWorkItem(ctx) {
	}
}

func (cc *ConnectionController) processNextWorkItem(ctx context.Context) bool {
	item, quit := cc.queue.Get()
	if quit {
		return false
	}
	defer cc.queue.Done(item)

	logger := logging.FromContext(ctx).With("work_key", item.key)
	logger.Info("ConnectionController processing key")

	err := cc.process(ctx, item)
	if err == nil {
		cc.queue.Forget(item)
		return true
	}

	item.attempts++
	logger = logger.With("error", err, "attempts", item.attempts)
	logger.Error("ConnectionController failed to process key")

	if item.attempts >= connectionMaxAttempts {
		logger.Error("ConnectionController failed too many times")
		cc.queue.Forget(item)
		return true
	}

	if !apierrors.IsServiceUnavailable(err) {
		logger.Info("ConnectionController will not retry")
		cc.queue.Forget(item)
		return true
	}

	logger.Info("ConnectionController will retry as service is unavailable")
	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", item, err))
	cc.queue.AddRateLimited(item)

	return true
}

func (cc *ConnectionController) process(ctx context.Context, item *connectionQueueItem) error {
	logger := cc.logger.With("key", item.key)
	ctx = logging.Context(ctx, logger)

	namespace, name, err := cache.SplitMetaNamespaceKey(item.key)
	if err != nil {
		return err
	}

	conn, err := cc.connLister.Connections(namespace).Get(name)
	switch {
	case apierrors.IsNotFound(err):
		return errors.New("connection not found in cache")
	case err != nil:
		return err
	}

	// Handle deletion if being deleted
	if conn.DeletionTimestamp != nil {
		return cc.handleDelete(ctx, conn)
	}

	hasSpecChanged := conn.Generation != conn.Status.ObservedGeneration
	shouldCheckHealth := cc.shouldCheckHealth(conn)

	// Determine the main triggering condition
	switch {
	case hasSpecChanged:
		logger.Info("spec changed, reconciling", "generation", conn.Generation, "observedGeneration", conn.Status.ObservedGeneration)
	case shouldCheckHealth:
		logger.Info("health is stale, refreshing", "lastChecked", conn.Status.Health.Checked, "healthy", conn.Status.Health.Healthy)
	default:
		logger.Debug("skipping as conditions are not met", "generation", conn.Generation, "observedGeneration", conn.Status.ObservedGeneration)
		return nil
	}

	// For now, just update the state to connected, health to healthy, and observed generation
	// Future: Add credential validation logic here
	patchOperations := []map[string]interface{}{}

	// Only update observedGeneration when spec changes
	if hasSpecChanged {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": conn.Generation,
		})
	}

	// Always update state and health
	patchOperations = append(patchOperations,
		map[string]interface{}{
			"op":    "replace",
			"path":  "/status/state",
			"value": provisioning.ConnectionStateConnected,
		},
		map[string]interface{}{
			"op":   "replace",
			"path": "/status/health",
			"value": provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().UnixMilli(),
			},
		},
	)

	if err := cc.statusPatcher.Patch(ctx, conn, patchOperations...); err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	logger.Info("connection reconciled successfully")
	return nil
}

func (cc *ConnectionController) handleDelete(ctx context.Context, conn *provisioning.Connection) error {
	logger := logging.FromContext(ctx)
	logger.Info("handle connection delete")

	// Check if finalizer is present
	hasFinalizer := false
	for _, f := range conn.Finalizers {
		if f == connectionvalidation.BlockDeletionFinalizer {
			hasFinalizer = true
			break
		}
	}

	if !hasFinalizer {
		logger.Info("no finalizer to process")
		return nil
	}

	// Check if any repositories reference this connection using field selector
	fieldSelector := fields.OneTermEqualSelector("spec.connection.name", conn.Name)
	var allRepos []provisioning.Repository
	continueToken := ""
	var err error

	for {
		var obj runtime.Object
		obj, err = cc.repoLister.List(ctx, &internalversion.ListOptions{
			Limit:         100,
			Continue:      continueToken,
			FieldSelector: fieldSelector,
		})
		if err != nil {
			logger.Error("failed to check for connected repositories", "error", err)
			return fmt.Errorf("check for connected repositories: %w", err)
		}

		repositoryList, ok := obj.(*provisioning.RepositoryList)
		if !ok {
			logger.Error("expected repository list", "type", fmt.Sprintf("%T", obj))
			return fmt.Errorf("expected repository list, got %T", obj)
		}

		allRepos = append(allRepos, repositoryList.Items...)

		continueToken = repositoryList.GetContinue()
		if continueToken == "" {
			break
		}
	}

	if len(allRepos) > 0 {
		repoNames := make([]string, 0, len(allRepos))
		for _, repo := range allRepos {
			repoNames = append(repoNames, repo.Name)
		}
		logger.Info("cannot delete connection while repositories reference it", "repositories", repoNames)
		// Don't remove finalizer - this will prevent deletion
		// The connection will remain in deletion state until repositories are removed
		return fmt.Errorf("cannot delete connection while repositories are using it: %s", strings.Join(repoNames, ", "))
	}

	// No repositories reference this connection, remove finalizer to allow deletion
	logger.Info("no repositories reference connection, removing finalizer")
	_, err = cc.client.Connections(conn.GetNamespace()).
		Patch(ctx, conn.Name, types.JSONPatchType, []byte(`[
			{ "op": "remove", "path": "/metadata/finalizers" }
		]`), metav1.PatchOptions{
			FieldManager: "provisioning-connection-controller",
		})
	if err != nil {
		return fmt.Errorf("remove finalizer: %w", err)
	}

	return nil
}

// shouldCheckHealth determines if a connection health check should be performed.
func (cc *ConnectionController) shouldCheckHealth(conn *provisioning.Connection) bool {
	// If the connection has been updated, always check health
	if conn.Generation != conn.Status.ObservedGeneration {
		return true
	}

	// Check if health check is stale
	return !cc.hasRecentHealthCheck(conn.Status.Health)
}

// hasRecentHealthCheck checks if a health check was performed recently.
func (cc *ConnectionController) hasRecentHealthCheck(healthStatus provisioning.HealthStatus) bool {
	if healthStatus.Checked == 0 {
		return false // Never checked
	}

	age := time.Since(time.UnixMilli(healthStatus.Checked))
	if healthStatus.Healthy {
		return age <= connectionHealthyDuration
	}
	return age <= connectionUnhealthyDuration
}
