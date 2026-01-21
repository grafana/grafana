package controller

import (
	"context"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

const connectionLoggerName = "provisioning-connection-controller"

const (
	connectionMaxAttempts = 3
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

// ConnectionController controls Connection resources.
type ConnectionController struct {
	client     client.ProvisioningV0alpha1Interface
	connLister listers.ConnectionLister
	connSynced cache.InformerSynced
	logger     logging.Logger

	statusPatcher     ConnectionStatusPatcher
	healthChecker     *ConnectionHealthChecker
	connectionFactory connection.Factory

	queue workqueue.TypedRateLimitingInterface[*connectionQueueItem]
}

// NewConnectionController creates a new ConnectionController.
func NewConnectionController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	connInformer informer.ConnectionInformer,
	statusPatcher ConnectionStatusPatcher,
	healthChecker *ConnectionHealthChecker,
	connectionFactory connection.Factory,
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
		statusPatcher:     statusPatcher,
		healthChecker:     healthChecker,
		connectionFactory: connectionFactory,
		logger:            logging.DefaultLogger.With("logger", connectionLoggerName),
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
		logger.Error("retrieving namespace and name from key", "error", err)
		return err
	}

	conn, err := cc.connLister.Connections(namespace).Get(name)
	switch {
	case apierrors.IsNotFound(err):
		return errors.New("connection not found in cache")
	case err != nil:
		logger.Error("getting connection", "error", err)
		return err
	}

	logger = logger.With("connection", conn.Name, "namespace", conn.Namespace)

	// Skip if being deleted
	if conn.DeletionTimestamp != nil {
		logger.Info("connection is being deleted, skipping")
		return nil
	}

	hasSpecChanged := conn.Generation != conn.Status.ObservedGeneration
	shouldCheckHealth := cc.healthChecker.ShouldCheckHealth(conn)

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

	var patchOperations []map[string]interface{}

	if hasSpecChanged {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/observedGeneration",
			"value": conn.Generation,
		})
	}

	// Regenerate JWT token if needed (before health check)
	// This ensures the health check uses a fresh, valid token
	if cc.shouldRegenerateToken(conn) {
		logger.Info("regenerating connection token")

		tokenOps, err := cc.generateConnectionToken(ctx, conn)
		if err != nil {
			// Log error but continue - health check will surface the issue
			logger.Error("failed to generate connection token", "error", err)
		} else if len(tokenOps) > 0 {
			patchOperations = append(patchOperations, tokenOps...)
		}
	}

	// Handle health checks using the health checker
	testResults, healthStatus, healthPatchOps, err := cc.healthChecker.RefreshHealthWithPatchOps(ctx, conn)
	if err != nil {
		logger.Error("failed to get updated health status", "error", err)
		return fmt.Errorf("update health status: %w", err)
	}
	patchOperations = append(patchOperations, healthPatchOps...)

	// Update state based on health status
	if healthStatus.Healthy {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/state",
			"value": provisioning.ConnectionStateConnected,
		})
	} else {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/state",
			"value": provisioning.ConnectionStateDisconnected,
		})
	}

	// Update fieldErrors from test results - ensure fieldErrors are cleared when there are no errors
	fieldErrors := testResults.Errors
	if fieldErrors == nil {
		fieldErrors = []provisioning.ErrorDetails{}
	}
	patchOperations = append(patchOperations, map[string]interface{}{
		"op":    "replace",
		"path":  "/status/fieldErrors",
		"value": fieldErrors,
	})

	if len(patchOperations) > 0 {
		// Update fieldErrors from test results
		if err := cc.statusPatcher.Patch(ctx, conn, patchOperations...); err != nil {
			return fmt.Errorf("failed to update connection status: %w", err)
		}
	}

	logger.Info("connection reconciled successfully", "healthy", healthStatus.Healthy)
	return nil
}

// shouldRegenerateToken determines if connection token should be regenerated.
// Returns true only when the previous health check failed.
func (cc *ConnectionController) shouldRegenerateToken(conn *provisioning.Connection) bool {
	// Only regenerate if the previous health check failed
	// TODO(ferruvich): here we should retrieve the secret (by building the connection)
	//  gather the token, and decode it to properly verify the expiration is elapsed.
	return conn.Status.Health.Checked != 0 && !conn.Status.Health.Healthy
}

// generateConnectionToken regenerates the connection token if the connection supports it.
// Uses the TokenGenerator interface to generate tokens in a connection-type-agnostic way.
// Returns patch operations to update the /secure/token field.
func (cc *ConnectionController) generateConnectionToken(
	ctx context.Context,
	conn *provisioning.Connection,
) ([]map[string]interface{}, error) {
	logger := logging.FromContext(ctx)

	builtConnection, err := cc.connectionFactory.Build(ctx, conn)
	if err != nil {
		logger.Error("failed to build connection", "error", err)
		return nil, nil // Non-blocking: return empty patches
	}

	// TODO(ferruvich): move this to before shouldRegenerateToken is called.
	//  We should check if the connection can generate a token, and only then verify we need to generate one.
	tokenGen, ok := builtConnection.(connection.TokenGenerator)
	if !ok {
		logger.Debug("connection type does not support token generation, skipping")
		return nil, nil
	}

	token, err := tokenGen.GenerateConnectionToken(ctx)
	if err != nil {
		logger.Error("failed to generate connection token", "error", err)
		return nil, nil // Non-blocking: return empty patches
	}

	logger.Info("successfully generated new connection token")

	patchOperations := []map[string]interface{}{
		{
			"op":   "replace",
			"path": "/secure/token",
			"value": map[string]string{
				"create": string(token),
			},
		},
	}

	return patchOperations, nil
}
