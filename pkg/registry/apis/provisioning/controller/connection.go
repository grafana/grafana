package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/retry"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const connectionLoggerName = "provisioning-connection-controller"

const (
	connectionMaxAttempts = 3
	// connectionDeleteRequeueDelay is the backstop interval for re-checking whether
	// the repositories that reference a connection being deleted have finished
	// terminating, so its finalizer can be removed. Repository deletions also
	// enqueue the connection directly (see enqueueConnectionForRepo), so this is a
	// safety net rather than the primary trigger.
	connectionDeleteRequeueDelay = 10 * time.Second
)

type connectionQueueItem struct {
	key      string
	attempts int
}

// ConnectionStatusPatcher defines the interface for updating connection status.
//
//go:generate mockery --name=ConnectionStatusPatcher --structname=MockConnectionStatusPatcher --inpackage --filename=connection_status_patcher_mock.go --with-expecter
type ConnectionStatusPatcher interface {
	Patch(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) error
}

// ConnectionController controls Connection resources.
type ConnectionController struct {
	client     client.ProvisioningV0alpha1Interface
	connLister listers.ConnectionLister
	repoLister listers.RepositoryLister
	connSynced cache.InformerSynced
	logger     logging.Logger

	statusPatcher     ConnectionStatusPatcher
	healthChecker     ConnectionHealthCheckerInterface
	connectionFactory connection.Factory
	tokenMetrics      *connectionTokenMetrics

	// To allow injection for testing.
	processFn func(ctx context.Context, item *connectionQueueItem) error

	queue          workqueue.TypedRateLimitingInterface[*connectionQueueItem]
	resyncInterval time.Duration
	drainTimeout   time.Duration
}

// NewConnectionController creates a new ConnectionController.
func NewConnectionController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	connInformer informer.ConnectionInformer,
	repoInformer informer.RepositoryInformer,
	statusPatcher ConnectionStatusPatcher,
	healthChecker *ConnectionHealthChecker,
	connectionFactory connection.Factory,
	resyncInterval time.Duration,
	drainTimeout time.Duration,
	registry prometheus.Registerer,
) (*ConnectionController, error) {
	cc := &ConnectionController{
		client:     provisioningClient,
		connLister: connInformer.Lister(),
		repoLister: repoInformer.Lister(),
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
		tokenMetrics:      registerConnectionTokenMetrics(registry),
		logger:            logging.DefaultLogger.With("logger", connectionLoggerName),
		resyncInterval:    resyncInterval,
		drainTimeout:      drainTimeout,
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

	// React to repository changes so the connection's finalizer is kept in sync
	// with whether any repository references it, and so a connection being deleted
	// is reaped promptly once its last referencing repository is gone.
	_, err = repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: cc.enqueueConnectionForRepo,
		UpdateFunc: func(_, newObj interface{}) {
			cc.enqueueConnectionForRepo(newObj)
		},
		DeleteFunc: cc.enqueueConnectionForRepo,
	})
	if err != nil {
		return nil, err
	}

	cc.processFn = cc.process

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

// enqueueConnectionForRepo enqueues the connection referenced by a repository so
// that repository add/update/delete events drive the connection's finalizer
// reconciliation.
func (cc *ConnectionController) enqueueConnectionForRepo(obj interface{}) {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			return
		}
		repo, ok = tombstone.Obj.(*provisioning.Repository)
		if !ok {
			return
		}
	}

	connName := repo.ConnectionName()
	if connName == "" {
		return
	}
	cc.queue.Add(&connectionQueueItem{key: repo.GetNamespace() + "/" + connName})
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

	logger = logger.With("namespace", namespace, "connection", name)
	ctx = logging.Context(ctx, logger)

	// Handle deletion: gate removal until no repository references this connection.
	if conn.DeletionTimestamp != nil {
		return cc.handleDelete(ctx, conn, item)
	}

	// Skip reconciliation for resources whose namespace is being soft-deleted.
	if appcontroller.IsPendingDelete(conn.Labels) {
		logger.Info("skipping reconciliation: namespace is pending deletion")
		return nil
	}

	// Keep the finalizer in sync with whether any repository references this
	// connection. If this changed the connection, stop here: the patch re-enqueues
	// the connection, and the next pass reconciles health/token against fresh state.
	changed, err := cc.reconcileFinalizer(ctx, conn)
	if err != nil {
		return err
	}
	if changed {
		return nil
	}

	hasSpecChanged := conn.Generation != conn.Status.ObservedGeneration
	shouldCheckHealth := cc.healthChecker.ShouldCheckHealth(conn)

	c, err := cc.connectionFactory.Build(ctx, conn)
	if err != nil {
		logger.Error("failed to build connection", "error", err)
		return err
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

// reconcileFinalizer ensures the connection carries the referencing-repositories
// finalizer if and only if at least one repository references it. Keeping the
// finalizer off unreferenced connections lets them delete synchronously; it is
// present only while a referencing repository exists, which is exactly the window
// where the connection must be gated from removal so a terminating repository's
// own finalizers can still complete. It returns true if it patched the connection.
func (cc *ConnectionController) reconcileFinalizer(ctx context.Context, conn *provisioning.Connection) (bool, error) {
	repos, err := cc.repoLister.Repositories(conn.GetNamespace()).List(labels.Everything())
	if err != nil {
		return false, fmt.Errorf("list repositories for connection %q: %w", conn.GetName(), err)
	}

	var referenced bool
	for _, repo := range repos {
		if repo.ConnectionName() == conn.GetName() {
			referenced = true
			break
		}
	}

	has := slices.Contains(conn.Finalizers, connection.ReferencedByRepositoriesFinalizer)
	switch {
	case referenced && !has:
		return true, cc.setFinalizers(ctx, conn, append(slices.Clone(conn.Finalizers), connection.ReferencedByRepositoriesFinalizer))
	case !referenced && has:
		return true, cc.setFinalizers(ctx, conn, slices.DeleteFunc(slices.Clone(conn.Finalizers), func(f string) bool {
			return f == connection.ReferencedByRepositoriesFinalizer
		}))
	default:
		return false, nil
	}
}

// setFinalizers replaces the connection's finalizers via a JSON patch, retrying on
// optimistic-concurrency conflicts (the apiserver turns this into a
// read-modify-write with PreviousRV set, so concurrent writes race with it).
func (cc *ConnectionController) setFinalizers(ctx context.Context, conn *provisioning.Connection, finalizers []string) error {
	value, err := json.Marshal(finalizers)
	if err != nil {
		return err
	}
	// "add" creates the member if absent and replaces it otherwise.
	patch := fmt.Appendf(nil, `[{"op":"add","path":"/metadata/finalizers","value":%s}]`, value)
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		_, err := cc.client.Connections(conn.GetNamespace()).
			Patch(ctx, conn.GetName(), types.JSONPatchType, patch, metav1.PatchOptions{
				FieldManager: "provisioning-connection-controller",
			})
		return err
	})
}

// handleDelete gates connection deletion on its referencing repositories.
//
// A connection must outlive the repositories that reference it: repository
// deletion is asynchronous (finalizer-driven), and a repository's own finalizers
// may still need the connection's credentials while terminating. We keep the
// connection's finalizer in place until no referencing repository remains, then
// remove it so the API server can complete the deletion. While references remain
// the item is requeued after a short delay (the connection informer does not
// observe repository deletions, so we poll rather than wait for an event).
func (cc *ConnectionController) handleDelete(ctx context.Context, conn *provisioning.Connection, item *connectionQueueItem) error {
	logger := logging.FromContext(ctx)

	if !slices.Contains(conn.Finalizers, connection.ReferencedByRepositoriesFinalizer) {
		logger.Info("connection is being deleted, no finalizer to process")
		return nil
	}

	repos, err := cc.repoLister.Repositories(conn.Namespace).List(labels.Everything())
	if err != nil {
		return fmt.Errorf("list repositories for connection %q: %w", conn.Name, err)
	}

	var referencing int
	for _, repo := range repos {
		if repo.ConnectionName() == conn.Name {
			referencing++
		}
	}

	if referencing > 0 {
		logger.Info("waiting for referencing repositories before deleting connection", "referencing", referencing)
		cc.queue.AddAfter(item, connectionDeleteRequeueDelay)
		return nil
	}

	logger.Info("no referencing repositories remain, removing connection finalizer")

	// Connections only ever carry the single finalizer added by the mutator, so
	// removing the whole list is safe and matches the repository controller. Retry
	// on optimistic-concurrency conflicts: the apiserver turns this JSON Patch into
	// a read-modify-write that can race with concurrent writes on the connection.
	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		_, err := cc.client.Connections(conn.GetNamespace()).
			Patch(ctx, conn.Name, types.JSONPatchType, []byte(`[
				{ "op": "remove", "path": "/metadata/finalizers" }
			]`), metav1.PatchOptions{
				FieldManager: "provisioning-connection-controller",
			})
		return err
	})
	if err != nil {
		return fmt.Errorf("remove connection finalizer: %w", err)
	}

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
