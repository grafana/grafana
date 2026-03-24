package reconciler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ zanzana.MTReconciler = (*Reconciler)(nil)

type Reconciler struct {
	server        zanzana.ServerInternal
	clientFactory resources.ClientFactory
	cfg           Config
	logger        log.Logger
	tracer        tracing.Tracer
	metrics       *reconcilerMetrics
	leaderElector LeaderElector

	workQueue chan string

	globalRoleMu sync.RWMutex
	// resolved effective permissions per GlobalRole name (for Role composition)
	globalRolePerms map[string][]*authzextv1.RolePermission
}

// Config holds the reconciler configuration.
type Config struct {
	Workers             int
	Interval            time.Duration
	WriteBatchSize      int // Number of tuples to write in a single batch (0 = no batching)
	QueueSize           int // Size of the buffered work queue for namespaces (default 1000)
	ZanzanaReadPageSize int // Page size when reading tuples from Zanzana (default 1000)
}

func (c Config) queueSize() int {
	if c.QueueSize <= 0 {
		return 1000
	}
	return c.QueueSize
}

func (c Config) zanzanaReadPageSize() int32 {
	if c.ZanzanaReadPageSize <= 0 {
		return 1000
	}
	return int32(c.ZanzanaReadPageSize)
}

// GVRs that need to be reconciled from Unistore to Zanzana (namespaced).
var reconcileGVRs = []schema.GroupVersionResource{
	folderv1.FolderResourceInfo.GroupVersionResource(),
	iamv0.RoleInfo.GroupVersionResource(),
	iamv0.RoleBindingInfo.GroupVersionResource(),
	iamv0.ResourcePermissionInfo.GroupVersionResource(),
	iamv0.TeamBindingResourceInfo.GroupVersionResource(),
	iamv0.UserResourceInfo.GroupVersionResource(),
}

// NewReconciler creates a new reconciler instance.
func NewReconciler(
	srv zanzana.ServerInternal,
	clientFactory resources.ClientFactory,
	cfg Config,
	logger log.Logger,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	leaderElector LeaderElector,
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
// acquires leadership (or immediately for NoopLeaderElector).
func (r *Reconciler) runLoop(ctx context.Context) {
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

	// Fetch global role permissions once per tick and cache them for all namespaces.
	globalPerms, err := r.fetchGlobalRolePerms(ctx)
	if err != nil {
		r.logger.Error("Failed to fetch global roles", "error", err)
		globalPerms = nil
	}

	r.setGlobalRolePerms(globalPerms)

	stores, err := r.server.ListAllStores(ctx)
	if err != nil {
		r.logger.Error("Failed to list stores", "error", err)
		return
	}

	r.logger.Info("Queuing namespaces for reconciliation", "count", len(stores))

	for _, store := range stores {
		namespace := store.Name
		select {
		case r.workQueue <- namespace:
			r.metrics.workQueueDepth.Inc()
			r.logger.Debug("Queued namespace for reconciliation", "namespace", namespace)
		case <-ctx.Done():
			return
		}
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
			r.logger.Info("Reconciling namespace", "namespace", namespace, "workerID", workerID)
			start := time.Now()

			err := r.reconcileNamespace(ctx, namespace)
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
					r.logger.Error("Failed to reconcile namespace",
						"namespace", namespace,
						"workerID", workerID,
						"error", err,
						"duration", elapsed,
					)
				}
			} else {
				r.logger.Info("Successfully reconciled namespace",
					"namespace", namespace,
					"workerID", workerID,
					"duration", elapsed,
				)
			}
			r.metrics.namespaceDurationSeconds.WithLabelValues(status).Observe(elapsed.Seconds())
		}
	}
}

// reconcileNamespace performs reconciliation for a single namespace.
// It builds the expected tuple map from CRDs, then streams current tuples from Zanzana
// page-by-page to compute the diff
func (r *Reconciler) reconcileNamespace(ctx context.Context, namespace string) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.reconcileNamespace")
	defer span.End()

	// 1. Build expected tuple map from CRDs
	expectedMap, err := r.fetchAndTranslateTuples(ctx, namespace)
	if err != nil {
		if apierrors.IsNotFound(err) {
			r.logger.Warn("Namespace deleted or archived, removing store from Zanzana", "namespace", namespace)
			if delErr := r.server.DeleteStore(ctx, namespace); delErr != nil {
				r.logger.Error("Failed to delete orphaned store", "namespace", namespace, "error", delErr)
			}
			return nil
		}
		return fmt.Errorf("failed to fetch and translate CRDs: %w", err)
	}

	r.logger.Debug("Fetched and translated CRDs to tuples",
		"namespace", namespace,
		"expectedTuples", len(expectedMap),
	)

	// 2. Stream current tuples from Zanzana and compute diff
	toAdd, toDelete, err := r.computeDiffStreaming(ctx, namespace, expectedMap)
	if err != nil {
		return fmt.Errorf("failed to compute diff: %w", err)
	}

	r.logger.Info("Computed reconciliation diff",
		"namespace", namespace,
		"toAdd", len(toAdd),
		"toDelete", len(toDelete),
	)

	// 3. Apply changes if needed
	if len(toAdd) == 0 && len(toDelete) == 0 {
		r.logger.Info("Namespace is in sync, no changes needed", "namespace", namespace)
		return nil
	}

	if err := r.writeTuplesToZanzana(ctx, namespace, toAdd, toDelete); err != nil {
		return fmt.Errorf("failed to apply changes: %w", err)
	}

	r.logger.Info("Successfully applied reconciliation changes",
		"namespace", namespace,
		"added", len(toAdd),
		"deleted", len(toDelete),
	)

	return nil
}

// EnsureNamespace is not gated by leader election: it is called inline from
// the authorization request path and must complete before the caller can
// proceed. It only creates stores for new namespaces. Any overlap with the
// leader's background reconciliation loop is safe because reconcileNamespace
// is idempotent.
func (r *Reconciler) EnsureNamespace(ctx context.Context, namespace string) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.EnsureNamespace")
	defer span.End()

	store, err := r.server.GetStore(ctx, namespace)
	if err != nil && !errors.Is(err, zanzana.ErrStoreNotFound) {
		return fmt.Errorf("failed to get store: %w", err)
	}

	if store != nil {
		return nil
	}

	// Create store if it doesn't exist
	_, err = r.server.GetOrCreateStore(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to create store: %w", err)
	}

	err = r.reconcileNamespace(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to reconcile namespace: %w", err)
	}

	return nil
}
