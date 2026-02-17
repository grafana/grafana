package reconciler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server"
)

type Reconciler struct {
	server        *server.Server
	clientFactory resources.ClientFactory
	cfg           Config
	logger        log.Logger
	tracer        tracing.Tracer

	workQueue chan string
}

// Config holds the reconciler configuration.
type Config struct {
	Workers        int
	Interval       time.Duration
	WriteBatchSize int // Number of tuples to write in a single batch (0 = no batching)
	QueueSize      int // Size of the buffered work queue for namespaces (default 1000)
}

func (c Config) queueSize() int {
	if c.QueueSize <= 0 {
		return 1000
	}
	return c.QueueSize
}

// GVRs that need to be reconciled from Unistore to Zanzana.
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
	srv *server.Server,
	clientFactory resources.ClientFactory,
	cfg Config,
	logger log.Logger,
	tracer tracing.Tracer,
) *Reconciler {
	return &Reconciler{
		server:        srv,
		clientFactory: clientFactory,
		cfg:           cfg,
		logger:        logger,
		tracer:        tracer,
		workQueue:     make(chan string, cfg.queueSize()),
	}
}

// Run starts the reconciler's main loop and worker goroutines.
func (r *Reconciler) Run(ctx context.Context) error {
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
			close(r.workQueue) // Signal workers to stop
			wg.Wait()          // Wait for all workers to finish
			return ctx.Err()
		case <-ticker.C:
			r.queueAllNamespaces(ctx)
		}
	}
}

// queueAllNamespaces lists all OpenFGA stores and queues them for reconciliation.
func (r *Reconciler) queueAllNamespaces(ctx context.Context) {
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

			r.logger.Info("Reconciling namespace", "namespace", namespace, "workerID", workerID)
			start := time.Now()

			if err := r.reconcileNamespace(ctx, namespace); err != nil {
				r.logger.Error("Failed to reconcile namespace",
					"namespace", namespace,
					"workerID", workerID,
					"error", err,
					"duration", time.Since(start),
				)
			} else {
				r.logger.Info("Successfully reconciled namespace",
					"namespace", namespace,
					"workerID", workerID,
					"duration", time.Since(start),
				)
			}
		}
	}
}

// reconcileNamespace performs reconciliation for a single namespace.
// This is implemented in namespace.go.
func (r *Reconciler) reconcileNamespace(ctx context.Context, namespace string) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.reconcileNamespace")
	defer span.End()

	// 1. First, read all current tuples from Zanzana
	currentTuples, err := r.readAllTuplesFromZanzana(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to read current tuples: %w", err)
	}

	r.logger.Debug("Read current tuples from Zanzana",
		"namespace", namespace,
		"currentTuples", len(currentTuples),
	)

	// 2. Then, fetch CRDs from Unistore and translate to tuples
	expectedTuples, err := r.fetchAndTranslateTuples(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to fetch and translate CRDs: %w", err)
	}

	r.logger.Debug("Fetched and translated CRDs to tuples",
		"namespace", namespace,
		"expectedTuples", len(expectedTuples),
	)

	// 3. Compute diff
	toAdd, toDelete := ComputeDiff(expectedTuples, currentTuples)

	r.logger.Info("Computed reconciliation diff",
		"namespace", namespace,
		"toAdd", len(toAdd),
		"toDelete", len(toDelete),
	)

	// 4. Apply changes if needed
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
