package reconciler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"go.opentelemetry.io/otel/attribute"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ zanzana.MTReconciler = (*Reconciler)(nil)

// ReconcileResult holds statistics from a single namespace reconciliation,
// enabling rich completion logs for log-based table views (e.g., Loki/Grafana).
type ReconcileResult struct {
	ExpectedTuples int  // total tuples derived from CRDs
	TuplesToAdd    int  // tuples scheduled for write (may differ from actual on partial batch failure)
	TuplesToDelete int  // tuples scheduled for deletion (may differ from actual on partial batch failure)
	InSync         bool // true if no changes were needed
}

type Reconciler struct {
	server        zanzana.ServerInternal
	clientFactory resources.ClientFactory
	cfg           Config
	logger        log.Logger
	tracer        tracing.Tracer
	metrics       *reconcilerMetrics
	leaderElector leaderelection.Elector

	workQueue chan string

	// queuedNamespaces tracks namespaces that are currently either sitting in
	// workQueue or being processed by a worker. It is used to deduplicate
	// enqueues so a slow reconciliation cycle can't cause the same namespace to
	// pile up multiple times in the queue across ticks.
	queuedNamespaces sync.Map

	// ensuredNamespaces caches namespaces that have been fully reconciled - the store for this namespace exists with up to date permissions - in this
	// process lifetime so EnsureNamespace can short-circuit on subsequent calls
	// without taking any lock or making any RPC.
	ensuredNamespaces sync.Map
	ensureSF          singleflight.Group

	globalRoleMu sync.RWMutex
	// resolved effective permissions per GlobalRole name (for Role composition)
	globalRolePerms map[string][]*authzextv1.RolePermission
}

// Config holds the reconciler configuration.
type Config struct {
	Workers             int
	Interval            time.Duration
	WriteBatchSize      int                           // Number of tuples to write in a single batch (0 = no batching)
	QueueSize           int                           // Size of the buffered work queue for namespaces (default 1000)
	ZanzanaReadPageSize int                           // Page size when reading tuples from Zanzana (default 100, max 100)
	CRDs                []schema.GroupVersionResource // The set of namespaced resources the reconciler will translate
}

func (c Config) queueSize() int {
	if c.QueueSize <= 0 {
		return 1000
	}
	return c.QueueSize
}

func (c Config) zanzanaReadPageSize() int32 {
	if c.ZanzanaReadPageSize <= 0 {
		return 100
	}
	return int32(c.ZanzanaReadPageSize)
}

// defaultCRDs is the list of namespaced CRDs the reconciler will translate into Zanzana tuples.
var DefaultCRDs = []schema.GroupVersionResource{
	folderv1.FolderResourceInfo.GroupVersionResource(),
	iamv0.ResourcePermissionInfo.GroupVersionResource(),
	iamv0.TeamBindingResourceInfo.GroupVersionResource(),
	iamv0.UserResourceInfo.GroupVersionResource(),
	iamv0.ServiceAccountResourceInfo.GroupVersionResource(),
}

// NewReconciler creates a new reconciler instance.
func NewReconciler(
	srv zanzana.ServerInternal,
	clientFactory resources.ClientFactory,
	cfg Config,
	logger log.Logger,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	leaderElector leaderelection.Elector,
) *Reconciler {
	return &Reconciler{
		server:        srv,
		clientFactory: clientFactory,
		cfg:           cfg,
		logger:        logger,
		tracer:        tracer,
		metrics:       newReconcilerMetrics(reg),
		leaderElector: leaderElector,
		workQueue:     make(chan string, cfg.queueSize()),
	}
}

func (r *Reconciler) setGlobalRolePerms(perms map[string][]*authzextv1.RolePermission) {
	r.globalRoleMu.Lock()
	defer r.globalRoleMu.Unlock()
	r.globalRolePerms = perms
}

func (r *Reconciler) getGlobalRolePerms() map[string][]*authzextv1.RolePermission {
	r.globalRoleMu.RLock()
	defer r.globalRoleMu.RUnlock()
	return r.globalRolePerms
}

// Run starts leader election and delegates to runLoop when leadership is acquired.
func (r *Reconciler) Run(ctx context.Context) error {
	r.logger.Info("Starting MT reconciler")
	return r.leaderElector.Run(ctx, r.runLoop)
}

// runLoop contains the main reconciliation loop, started when this instance
// acquires leadership (or immediately for NoopElector).
func (r *Reconciler) runLoop(ctx context.Context) {
	r.metrics.isLeader.Set(1)
	defer r.metrics.isLeader.Set(0)

	r.logger.Info("Starting Unistore to Zanzana reconciler",
		"workers", r.cfg.Workers,
		"interval", r.cfg.Interval,
	)

	// Start worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < r.cfg.Workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			r.runWorker(ctx, workerID)
		}(i)
	}

	// Main loop - periodically list stores and queue work
	ticker := time.NewTicker(r.cfg.Interval)
	defer ticker.Stop()

	// Do an initial reconciliation immediately
	r.queueAllNamespaces(ctx)

	for {
		select {
		case <-ctx.Done():
			r.logger.Info("Reconciler shutting down")
			wg.Wait() // Workers exit via ctx.Done(); do not close the shared channel (it may be reused on re-election)
			return
		case <-ticker.C:
			r.queueAllNamespaces(ctx)
		}
	}
}

// queueAllNamespaces lists all OpenFGA stores and queues them for reconciliation.
func (r *Reconciler) queueAllNamespaces(ctx context.Context) {
	ctx, span := r.tracer.Start(ctx, "reconciler.queueAllNamespaces")
	defer span.End()

	start := time.Now()

	// Fetch global role permissions once per tick and cache them for all namespaces.
	globalPerms, err := r.fetchGlobalRolePerms(ctx)
	if err != nil {
		r.logger.Error("Failed to fetch global roles", "error", err)
		r.metrics.errorsTotal.WithLabelValues("fetch_global_roles").Inc()
		globalPerms = nil
	}

	r.setGlobalRolePerms(globalPerms)

	stores, err := r.server.ListAllStores(ctx)
	if err != nil {
		r.logger.Error("Failed to list stores", "error", err)
		r.metrics.errorsTotal.WithLabelValues("list_stores").Inc()
		return
	}

	if len(stores) == 0 {
		r.logger.Warn("No stores found, nothing to reconcile")
	}

	span.SetAttributes(attribute.Int("queue.namespaces_count", len(stores)))

	r.logger.Info("Queuing namespaces for reconciliation", "count", len(stores), "duration", time.Since(start))

	skipped := 0
	for _, store := range stores {
		namespace := store.Name

		// Deduplicate: skip if this namespace is already queued.
		if _, loaded := r.queuedNamespaces.LoadOrStore(namespace, struct{}{}); loaded {
			skipped++
			r.logger.Debug("Skipping namespace already in queue", "namespace", namespace)
			continue
		}

		select {
		case r.workQueue <- namespace:
			r.metrics.workQueueDepth.Inc()
			r.logger.Debug("Queued namespace for reconciliation", "namespace", namespace)
		case <-ctx.Done():
			// Release namespace so a future cycle can enqueue this namespace again.
			r.queuedNamespaces.Delete(namespace)
			return
		}
	}

	if skipped > 0 {
		r.logger.Info("Skipped namespaces already queued or in-flight", "skipped", skipped, "total", len(stores))
	}
}

// runWorker processes namespaces from the work queue.
func (r *Reconciler) runWorker(ctx context.Context, workerID int) {
	r.logger.Info("Starting reconciler worker", "workerID", workerID)

	for {
		select {
		case <-ctx.Done():
			return
		case namespace, ok := <-r.workQueue:
			if !ok {
				// Channel closed, worker should exit
				return
			}

			r.metrics.workQueueDepth.Dec()
			r.runNamespaceReconciliation(ctx, namespace, workerID)
		}
	}
}

func (r *Reconciler) runNamespaceReconciliation(ctx context.Context, namespace string, workerID int) {
	defer r.queuedNamespaces.Delete(namespace)

	start := time.Now()
	result, err := r.reconcileNamespace(ctx, namespace)
	elapsed := time.Since(start)
	status := "success"
	if err != nil {
		status = "error"
		if ctx.Err() != nil {
			r.logger.Warn("Reconciler shutdown during namespace reconciliation",
				"namespace", namespace,
				"workerID", workerID,
			)
		} else {
			logFields := []any{
				"namespace", namespace,
				"workerID", workerID,
				"error", err,
				"duration", elapsed,
			}
			if result != nil {
				logFields = append(logFields,
					"expectedTuples", result.ExpectedTuples,
					"tuplesToAdd", result.TuplesToAdd,
					"tuplesToDelete", result.TuplesToDelete,
				)
			}
			r.logger.Error("Failed to reconcile namespace", logFields...)
		}
	} else {
		logFields := []any{
			"namespace", namespace,
			"workerID", workerID,
			"duration", elapsed,
		}
		if result != nil {
			logFields = append(logFields,
				"expectedTuples", result.ExpectedTuples,
				"tuplesToAdd", result.TuplesToAdd,
				"tuplesToDelete", result.TuplesToDelete,
				"inSync", result.InSync,
			)
		}
		r.logger.Info("Reconciled namespace", logFields...)
	}
	r.metrics.namespaceDurationSeconds.WithLabelValues(status).Observe(elapsed.Seconds())
}

// reconcileNamespace performs reconciliation for a single namespace.
// It builds the expected tuple map from CRDs, then streams current tuples from Zanzana
// page-by-page to compute the diff
func (r *Reconciler) reconcileNamespace(ctx context.Context, namespace string) (*ReconcileResult, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.reconcileNamespace")
	defer span.End()

	span.SetAttributes(attribute.String("reconcile.namespace", namespace))

	result := &ReconcileResult{}

	// 1. Build expected tuple map from CRDs
	expectedMap, err := r.fetchAndTranslateTuples(ctx, namespace)
	if err != nil {
		if apierrors.IsNotFound(err) {
			r.logger.Warn("Namespace deleted or archived, removing store from Zanzana", "namespace", namespace)
			r.ensuredNamespaces.Delete(namespace)
			if delErr := r.server.DeleteStore(ctx, namespace); delErr != nil {
				r.logger.Error("Failed to delete orphaned store", "namespace", namespace, "error", delErr)
			}
			return nil, nil
		}
		r.metrics.errorsTotal.WithLabelValues("fetch_crds").Inc()
		return nil, fmt.Errorf("failed to fetch and translate CRDs: %w", err)
	}

	result.ExpectedTuples = len(expectedMap)

	span.SetAttributes(attribute.Int("reconcile.expected_tuples", result.ExpectedTuples))
	r.metrics.expectedTuples.Observe(float64(result.ExpectedTuples))

	// 2. Stream current tuples from Zanzana and compute diff
	toAdd, toDelete, err := r.computeDiffStreaming(ctx, namespace, expectedMap)
	if err != nil {
		r.metrics.errorsTotal.WithLabelValues("compute_diff").Inc()
		return result, fmt.Errorf("failed to compute diff: %w", err)
	}

	result.TuplesToAdd = len(toAdd)
	result.TuplesToDelete = len(toDelete)
	result.InSync = len(toAdd) == 0 && len(toDelete) == 0

	span.SetAttributes(
		attribute.Int("reconcile.tuples_to_add", result.TuplesToAdd),
		attribute.Int("reconcile.tuples_to_delete", result.TuplesToDelete),
	)
	r.metrics.diffTuples.WithLabelValues("add").Observe(float64(result.TuplesToAdd))
	r.metrics.diffTuples.WithLabelValues("delete").Observe(float64(result.TuplesToDelete))

	// 3. Apply changes if needed
	if result.InSync {
		return result, nil
	}

	if err := r.writeTuplesToZanzana(ctx, namespace, toAdd, toDelete); err != nil {
		r.metrics.errorsTotal.WithLabelValues("write_tuples").Inc()
		return result, fmt.Errorf("failed to apply changes: %w", err)
	}

	return result, nil
}

// EnsureNamespace is not gated by leader election: it is called inline from
// the authorization request path and must complete before the caller can
// proceed. It only creates stores for new namespaces. Any overlap with the
// leader's background reconciliation loop is safe because reconcileNamespace
// is idempotent.
func (r *Reconciler) EnsureNamespace(ctx context.Context, namespace string) error {
	if _, ok := r.ensuredNamespaces.Load(namespace); ok {
		return nil
	}

	start := time.Now()

	val, err, shared := r.ensureSF.Do(namespace, func() (any, error) {
		if _, ok := r.ensuredNamespaces.Load(namespace); ok {
			return false, nil
		}

		ctx, span := r.tracer.Start(ctx, "reconciler.EnsureNamespace")
		defer span.End()

		span.SetAttributes(attribute.String("ensure.namespace", namespace))
		storeCreated := false

		store, err := r.server.GetStore(ctx, namespace)
		if err != nil && !errors.Is(err, zanzana.ErrStoreNotFound) {
			return false, fmt.Errorf("failed to get store: %w", err)
		}

		if store == nil {
			storeCreated = true
			if _, err = r.server.GetOrCreateStore(ctx, namespace); err != nil {
				return false, fmt.Errorf("failed to create store: %w", err)
			}

			if _, err = r.reconcileNamespace(ctx, namespace); err != nil {
				return false, fmt.Errorf("failed to reconcile namespace: %w", err)
			}

			// Verify the store still exists — reconcileNamespace may have
			// deleted it if the namespace was removed while we were working.
			store, err = r.server.GetStore(ctx, namespace)
			if err != nil || store == nil {
				return false, fmt.Errorf("store disappeared during reconciliation for namespace %s", namespace)
			}
		}

		span.SetAttributes(attribute.Bool("ensure.store_created", storeCreated))

		r.logger.Info("EnsureNamespace reconciled namespace",
			"namespace", namespace,
			"duration", time.Since(start),
			"storeCreated", storeCreated,
		)

		r.ensuredNamespaces.Store(namespace, struct{}{})
		return true, nil
	})

	elapsed := time.Since(start)
	if err != nil {
		r.metrics.ensureNamespaceDurationSeconds.WithLabelValues("error").Observe(elapsed.Seconds())
		r.metrics.errorsTotal.WithLabelValues("ensure_namespace").Inc()
		return err
	}

	reconciled, _ := val.(bool)
	status := "existing"
	if shared {
		status = "waited"
	} else if reconciled {
		status = "reconciled"
	}
	r.metrics.ensureNamespaceDurationSeconds.WithLabelValues(status).Observe(elapsed.Seconds())
	return nil
}
