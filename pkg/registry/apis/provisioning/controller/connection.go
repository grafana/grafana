package controller

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

const connectionLoggerName = "provisioning-connection-controller"

const (
	connectionMaxAttempts = 3

	// tokenWriteRetryDelay is how long to wait before re-checking a connection or
	// repository whose token secret was written recently but is not yet readable from
	// the secret store. It is shared by the connection and repository controllers.
	tokenWriteRetryDelay = 2 * time.Second

	// notObservedRetryDelay is how long to wait before re-checking an object the
	// reconcile read has not observed yet (informer.ErrNotObserved) — a
	// read-after-write race under the NATS read seam, where the read is decoupled
	// from the notification that enqueued the key. maxNotObservedAttempts bounds
	// those retries; beyond it the key is dropped and left for the next resync, so
	// delay*attempts is the visibility window tolerated before falling back to
	// resync. Both are shared by the connection and repository controllers.
	notObservedRetryDelay  = 500 * time.Millisecond
	maxNotObservedAttempts = 6
)

type connectionQueueItem struct {
	key      string
	attempts int
	// notObservedAttempts counts consecutive ErrNotObserved retries so the
	// read-after-write requeue stays bounded. The same item is re-added on each
	// retry to carry the count forward.
	notObservedAttempts int
}

// ConnectionStatusPatcher defines the interface for updating connection status.
//
//go:generate mockery --name=ConnectionStatusPatcher --structname=MockConnectionStatusPatcher --inpackage --filename=connection_status_patcher_mock.go --with-expecter
type ConnectionStatusPatcher interface {
	Patch(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) error
}

// ConnectionController controls Connection resources.
type ConnectionController struct {
	conns  informer.ConnectionGetter
	logger logging.Logger

	statusPatcher     ConnectionStatusPatcher
	healthChecker     ConnectionHealthCheckerInterface
	connectionFactory connection.Factory
	tokenMetrics      *connectionTokenMetrics

	// To allow injection for testing.
	processFn func(ctx context.Context, item *connectionQueueItem) error

	queue          workqueue.TypedRateLimitingInterface[*connectionQueueItem]
	resyncInterval time.Duration
	drainTimeout   time.Duration
	// notObservedRetryDelay is the backoff before an ErrNotObserved requeue;
	// injectable so tests need not wait the production delay.
	notObservedRetryDelay time.Duration
}

// NewConnectionController creates a new ConnectionController.
func NewConnectionController(
	conns informer.ConnectionGetter,
	statusPatcher ConnectionStatusPatcher,
	healthChecker *ConnectionHealthChecker,
	connectionFactory connection.Factory,
	resyncInterval time.Duration,
	drainTimeout time.Duration,
	registry prometheus.Registerer,
) *ConnectionController {
	cc := &ConnectionController{
		conns: conns,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
			workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{
				Name: "provisioningConnectionController",
			},
		),
		statusPatcher:         statusPatcher,
		healthChecker:         healthChecker,
		connectionFactory:     connectionFactory,
		tokenMetrics:          registerConnectionTokenMetrics(registry),
		logger:                logging.DefaultLogger.With("logger", connectionLoggerName),
		resyncInterval:        resyncInterval,
		drainTimeout:          drainTimeout,
		notObservedRetryDelay: notObservedRetryDelay,
	}

	cc.processFn = cc.process

	return cc
}

// EventHandler returns the informer event handlers for the controller. Register
// it with the Connection informer to enqueue connections on add and update.
func (cc *ConnectionController) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: cc.enqueue,
		UpdateFunc: func(oldObj, newObj interface{}) {
			cc.enqueue(newObj)
		},
	}
}

func (cc *ConnectionController) enqueue(obj interface{}) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		cc.logger.Error("failed to get key for object", "error", err)
		return
	}
	cc.queue.Add(&connectionQueueItem{key: key})
}

// Run starts the ConnectionController. The onStarted callback is invoked once
// all workers have been launched, before blocking on ctx.Done().
func (cc *ConnectionController) Run(ctx context.Context, workerCount int, onStarted func(), onShutdown func()) {
	defer utilruntime.HandleCrash()
	defer cc.queue.ShutDown()

	logger := cc.logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting ConnectionController")
	defer logger.Info("Shutting down ConnectionController")

	logger.Info("Starting workers", "count", workerCount)
	for i := range workerCount {
		workerCtx := logging.Context(ctx, logger.With("worker_id", i))
		go wait.UntilWithContext(workerCtx, cc.runWorker, time.Second)
	}

	logger.Info("Started workers")
	onStarted()

	<-ctx.Done()
	onShutdown()
	logger.Info("Shutting down workers, draining queue")

	drainDone := make(chan struct{})
	go func() {
		cc.queue.ShutDownWithDrain()
		close(drainDone)
	}()

	select {
	case <-drainDone:
		logger.Info("Queue drained successfully")
	case <-time.After(cc.drainTimeout):
		logger.Warn("Drain timeout exceeded, forcing shutdown")
		cc.queue.ShutDown()
	}
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

	namespace, name, _ := cache.SplitMetaNamespaceKey(item.key)
	logger := logging.FromContext(ctx).With("work_key", item.key, "namespace", namespace, "connection", name)
	logger.Info("ConnectionController processing key")

	err := cc.processFn(ctx, item)
	if err == nil {
		cc.queue.Forget(item)
		return true
	}

	// The reconcile read has not observed the connection yet. Under the NATS read
	// seam the read is decoupled from the notification that enqueued this key, so
	// this is typically a read-after-write race on a just-created or just-updated
	// connection. Requeue the same item (carrying its retry count) with a fixed
	// short delay (bounded) to let the write become visible, rather than dropping
	// it until the next resync; a genuinely deleted connection exhausts the
	// retries and is then forgotten.
	if errors.Is(err, informer.ErrNotObserved) {
		item.notObservedAttempts++
		if item.notObservedAttempts >= maxNotObservedAttempts {
			logger.With("attempts", item.notObservedAttempts).Info("ConnectionController: connection still not observed after retries; leaving for the next resync")
			cc.queue.Forget(item)
			return true
		}
		logger.With("attempts", item.notObservedAttempts).Debug("ConnectionController: connection not yet observed, requeuing")
		cc.queue.AddAfter(item, cc.notObservedRetryDelay)
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

	// Reconcile the object the read seam returns; how it is sourced and kept
	// fresh is the informer.ConnectionGetter's concern, not the controller's.
	conn, err := cc.conns.Get(ctx, namespace, name)
	switch {
	case errors.Is(err, informer.ErrNotObserved):
		// Retryable: the read seam has not observed the connection yet (a NATS
		// read-after-write race). processNextWorkItem requeues it with backoff.
		return err
	case apierrors.IsNotFound(err):
		// Authoritative delete from the apiserver cache lister: the connection is
		// gone, so there is nothing to reconcile.
		logger.Debug("connection not found; already deleted, nothing to reconcile")
		return nil
	case err != nil:
		logger.Error("getting connection", "error", err)
		return err
	}

	logger = logger.With("namespace", namespace, "connection", name)
	ctx = logging.Context(ctx, logger)

	// Skip if being deleted
	if conn.DeletionTimestamp != nil {
		logger.Info("connection is being deleted, skipping")
		return nil
	}

	// Skip reconciliation for resources whose namespace is being soft-deleted.
	if appcontroller.IsPendingDelete(conn.Labels) {
		logger.Info("skipping reconciliation: namespace is pending deletion")
		return nil
	}

	hasSpecChanged := conn.Generation != conn.Status.ObservedGeneration
	shouldCheckHealth := cc.healthChecker.ShouldCheckHealth(conn)

	c, err := cc.connectionFactory.Build(ctx, conn)
	if err != nil {
		// The token references a stored secret that could not be decrypted (e.g. an
		// orphaned reference whose secret was deleted). Regenerate it from the private
		// key by clearing the reference on a copy (the rebuild then skips token
		// decryption and shouldGenerateToken re-mints it). Rebuild on a copy to avoid
		// mutating the shared informer cache.
		if errors.Is(err, connection.ErrTokenNotFound) {
			// If we wrote a token for this connection very recently, its secret may not
			// be readable from the store yet. Wait for it rather than regenerating, which
			// would delete it and can loop under secret-store read-after-write lag.
			if tokenRecentlyCreated(time.UnixMilli(conn.Status.Token.LastUpdated)) {
				logger.Info("connection token secret not yet readable after recent write; will retry", "error", err)
				cc.queue.AddAfter(&connectionQueueItem{key: item.key}, tokenWriteRetryDelay)
				return nil
			}
			logger.Warn("connection token secret could not be decrypted, regenerating", "error", err)
			conn = conn.DeepCopy()
			conn.Secure.Token = common.InlineSecureValue{}
			c, err = cc.connectionFactory.Build(ctx, conn)
		}
		if err != nil {
			logger.Error("failed to build connection", "error", err)
			return err
		}
	}

	tokenConn, isTokenConnection := c.(connection.TokenConnection)
	var shouldRefreshToken bool
	if isTokenConnection {
		shouldRefreshToken, err = cc.shouldGenerateToken(ctx, conn, tokenConn)
		if err != nil {
			logger.Error("failed to check if token needs to be generated", "error", err)
			return err
		}
	}

	// Determine the main triggering condition
	switch {
	case hasSpecChanged:
		logger.Info("spec changed, reconciling", "generation", conn.Generation, "observedGeneration", conn.Status.ObservedGeneration)
	case shouldCheckHealth:
		logger.Info("health is stale, refreshing", "lastChecked", conn.Status.Health.Checked, "healthy", conn.Status.Health.Healthy)
	case shouldRefreshToken:
		logger.Info("token must be refreshed or generated")
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

	if isTokenConnection && shouldRefreshToken {
		logger.Info("generating connection token")

		token, tokenOps, err := cc.generateConnectionToken(ctx, tokenConn)
		if err != nil {
			logger.Error("failed to generate connection token", "error", err)
			return err
		}

		if len(tokenOps) > 0 {
			patchOperations = append(patchOperations, tokenOps...)
			// Record when the token was written so a not-yet-readable secret on the next
			// reconcile is not mistaken for a missing one and regenerated in a loop. Use
			// "add": status.token is a newly introduced field that may be absent on
			// Connections created before this change, and "add" both creates and replaces.
			patchOperations = append(patchOperations, map[string]interface{}{
				"op":    "add",
				"path":  "/status/token",
				"value": provisioning.TokenStatus{LastUpdated: time.Now().UnixMilli()},
			})
		}
		conn.Secure.Token = common.InlineSecureValue{Create: common.NewSecretValue(token)}
	}

	// Handle health checks using the health checker
	healthResult, err := cc.healthChecker.RefreshHealthWithPatchOps(ctx, conn)
	if err != nil {
		logger.Error("failed to get updated health status", "error", err)
		return fmt.Errorf("update health status: %w", err)
	}
	testResults := healthResult.TestResults
	healthStatus := healthResult.HealthStatus

	if len(healthResult.PatchOps) > 0 {
		patchOperations = append(patchOperations, healthResult.PatchOps...)
	}
	if conditionPatchOps := BuildConditionPatchOpsFromExisting(
		conn.Status.Conditions, conn.GetGeneration(), healthResult.ReadyCondition,
	); conditionPatchOps != nil {
		patchOperations = append(patchOperations, conditionPatchOps...)
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

func (cc *ConnectionController) shouldGenerateToken(
	ctx context.Context,
	obj *provisioning.Connection,
	c connection.TokenConnection,
) (bool, error) {
	if obj.Secure.Token.IsZero() {
		cc.tokenMetrics.recordRefreshReason(refreshReasonMissing)
		return true, nil
	}

	if !c.TokenValid(ctx) {
		cc.tokenMetrics.recordRefreshReason(refreshReasonInvalid)
		return true, nil
	}

	issuingTime, err := c.TokenCreationTime(ctx)
	if err != nil {
		return false, err
	}

	if tokenRecentlyCreated(issuingTime) {
		return false, nil
	}

	expiration, err := c.TokenExpiration(ctx)
	if err != nil {
		return false, err
	}

	cc.tokenMetrics.recordTimeToExpiry(time.Until(expiration).Seconds())

	if shouldRefreshBeforeExpiration(expiration, cc.resyncInterval) {
		cc.tokenMetrics.recordRefreshReason(refreshReasonExpiring)
		return true, nil
	}

	return false, nil
}

// generateConnectionToken regenerates the connection token if the connection supports it.
// Uses the TokenGenerator interface to generate tokens in a connection-type-agnostic way.
// Returns patch operations to update the /secure/token field.
func (cc *ConnectionController) generateConnectionToken(
	ctx context.Context,
	conn connection.TokenConnection,
) (string, []map[string]interface{}, error) {
	logger := logging.FromContext(ctx)

	start := time.Now()
	var failed bool
	defer func() {
		if failed {
			cc.tokenMetrics.recordGenerationError()
		} else {
			cc.tokenMetrics.recordGeneration(time.Since(start).Seconds())
		}
	}()

	token, err := conn.GenerateConnectionToken(ctx)
	if err != nil {
		failed = true
		logger.Error("failed to generate connection token", "error", err)
		return "", nil, nil // Non-blocking: return empty patches
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

	return string(token), patchOperations, nil
}
