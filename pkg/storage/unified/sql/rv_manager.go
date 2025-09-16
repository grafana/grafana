package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	rvmWriteDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:                        "rvmanager_write_duration_seconds",
		Help:                        "Duration of ResourceVersionManager write operations",
		Namespace:                   "grafana",
		NativeHistogramBucketFactor: 1.1,
	}, []string{"group", "resource", "status"})

	rvmExecBatchDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:                        "rvmanager_exec_batch_duration_seconds",
		Help:                        "Duration of ResourceVersionManager batch operations",
		Namespace:                   "grafana",
		NativeHistogramBucketFactor: 1.1,
	}, []string{"group", "resource", "status"})

	rvmExecBatchPhaseDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:                        "rvmanager_exec_batch_phase_duration_seconds",
		Help:                        "Duration of batch operation phases",
		Namespace:                   "grafana",
		NativeHistogramBucketFactor: 1.1,
	}, []string{"group", "resource", "phase"})

	rvmInflightWrites = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "rvmanager_inflight_writes",
		Help:      "Number of concurrent write operations",
		Namespace: "grafana",
	}, []string{"group", "resource"})

	rvmBatchSize = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:                        "rvmanager_batch_size",
		Help:                        "Number of write operations per batch",
		Namespace:                   "grafana",
		NativeHistogramBucketFactor: 1.1,
	}, []string{"group", "resource"})
)

const (
	defaultMaxBatchSize     = 25
	defaultMaxBatchWaitTime = 100 * time.Millisecond
	defaultBatchTimeout     = 5 * time.Second
)

// resourceVersionManager handles resource version operations
type resourceVersionManager struct {
	dialect    sqltemplate.Dialect
	db         db.DB
	tracer     trace.Tracer
	batchMu    sync.RWMutex
	batchChMap map[string]chan *writeOp

	maxBatchSize     int           // The maximum number of operations to batch together
	maxBatchWaitTime time.Duration // The maximum time to wait for a batch to be ready
}

type writeOpResult struct {
	guid           string
	rv             int64
	err            error
	batchTraceLink trace.Link
}

// writeOp is a write operation that is executed with an incremented resource version
type writeOp struct {
	key  *resourcepb.ResourceKey // The key of the resource
	fn   WriteEventFunc          // The function to execute to write the event
	done chan writeOpResult      // A channel informing the operation is done
}

// WriteEventFunc is a function that writes a resource to the database
// It returns the GUID of the created resource
// The GUID is used to update the resource version for the resource in the same transaction.
type WriteEventFunc func(tx db.Tx) (guid string, err error)

type ResourceManagerOptions struct {
	Dialect          sqltemplate.Dialect // The dialect to use for the database
	DB               db.DB               // The database to use
	MaxBatchSize     int                 // The maximum number of operations to batch together
	MaxBatchWaitTime time.Duration       // The maximum time to wait for a batch to be ready
	Tracer           trace.Tracer        // The tracer to use for tracing
}

// NewResourceVersionManager creates a new ResourceVersionManager
func NewResourceVersionManager(opts ResourceManagerOptions) (*resourceVersionManager, error) {
	if opts.MaxBatchSize == 0 {
		opts.MaxBatchSize = defaultMaxBatchSize
	}
	if opts.MaxBatchWaitTime == 0 {
		opts.MaxBatchWaitTime = defaultMaxBatchWaitTime
	}
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-version-manager")
	}
	if opts.Dialect == nil {
		return nil, errors.New("dialect is required")
	}
	if opts.DB == nil {
		return nil, errors.New("db is required")
	}
	return &resourceVersionManager{
		dialect:          opts.Dialect,
		db:               opts.DB,
		tracer:           opts.Tracer,
		batchChMap:       make(map[string]chan *writeOp),
		maxBatchSize:     opts.MaxBatchSize,
		maxBatchWaitTime: opts.MaxBatchWaitTime,
	}, nil
}

// ExecWithRV executes the given function with an incremented resource version
func (m *resourceVersionManager) ExecWithRV(ctx context.Context, key *resourcepb.ResourceKey, fn WriteEventFunc) (rv int64, err error) {
	rvmInflightWrites.WithLabelValues(key.Group, key.Resource).Inc()
	defer rvmInflightWrites.WithLabelValues(key.Group, key.Resource).Dec()

	var status string
	timer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
		status = "success"
		if err != nil {
			status = "error"
		}
		rvmWriteDuration.WithLabelValues(key.Group, key.Resource, status).Observe(v)
	}))
	defer timer.ObserveDuration()

	ctx, span := m.tracer.Start(ctx, "sql.rvmanager.ExecWithRV")
	defer span.End()

	span.SetAttributes(
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
	)
	op := writeOp{key: key, fn: fn, done: make(chan writeOpResult, 1)}
	batchKey := fmt.Sprintf("%s/%s", key.Group, key.Resource)

	m.batchMu.Lock()
	ch, ok := m.batchChMap[batchKey]
	if !ok {
		ch = make(chan *writeOp, m.maxBatchSize)
		m.batchChMap[batchKey] = ch
		go m.startBatchProcessor(key.Group, key.Resource)
	}
	m.batchMu.Unlock()
	select {
	case ch <- &op:
	case <-ctx.Done():
		return 0, ctx.Err()
	}

	select {
	case res := <-op.done:
		if res.err != nil {
			span.RecordError(res.err)
		}
		span.SetAttributes(
			attribute.String("guid", res.guid),
			attribute.Int64("resource_version", res.rv),
		)
		span.AddLink(res.batchTraceLink)

		return res.rv, res.err
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

// startBatchProcessor is responsible for processing batches of write operations
func (m *resourceVersionManager) startBatchProcessor(group, resource string) {
	ctx := context.TODO()
	batchKey := fmt.Sprintf("%s/%s", group, resource)

	m.batchMu.Lock()
	ch, ok := m.batchChMap[batchKey]
	if !ok {
		m.batchMu.Unlock()
		return
	}
	m.batchMu.Unlock()

	for {
		batch := make([]writeOp, 0, m.maxBatchSize)
		// wait for a new writeOp
		select {
		case op := <-ch:
			batch = append(batch, *op)
		case <-ctx.Done():
			return
		}

	prepare:
		for len(batch) < m.maxBatchSize {
			select {
			case op := <-ch:
				batch = append(batch, *op)
			default:
				break prepare
			}
		}

		rvmBatchSize.WithLabelValues(group, resource).Observe(float64(len(batch)))
		m.execBatch(ctx, group, resource, batch)
	}
}

func (m *resourceVersionManager) execBatch(ctx context.Context, group, resource string, batch []writeOp) {
	ctx, span := m.tracer.Start(ctx, "sql.rvmanager.execBatch")
	defer span.End()

	// Add batch size attribute
	span.SetAttributes(
		attribute.Int("batch_size", len(batch)),
		attribute.String("group", group),
		attribute.String("resource", resource),
	)

	var err error
	timer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
		status := "success"
		if err != nil {
			status = "error"
		}
		rvmExecBatchDuration.WithLabelValues(group, resource, status).Observe(v)
	}))
	defer timer.ObserveDuration()

	ctx, cancel := context.WithTimeout(ctx, defaultBatchTimeout)
	defer cancel()

	guidToRV := make(map[string]int64, len(batch))
	guids := make([]string, len(batch)) // The GUIDs of the created resources in the same order as the batch
	rvs := make([]int64, len(batch))    // The RVs of the created resources in the same order as the batch

	err = m.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		span.AddEvent("starting_batch_transaction")

		writeTimer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
			rvmExecBatchPhaseDuration.WithLabelValues(group, resource, "write_ops").Observe(v)
		}))
		for i := range batch {
			guid, err := batch[i].fn(tx)
			if err != nil {
				span.AddEvent("batch_operation_failed", trace.WithAttributes(
					attribute.Int("operation_index", i),
					attribute.String("error", err.Error()),
				))
				return fmt.Errorf("failed to execute function: %w", err)
			}
			guids[i] = guid
		}
		writeTimer.ObserveDuration()
		span.AddEvent("batch_operations_completed")

		lockTimer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
			rvmExecBatchPhaseDuration.WithLabelValues(group, resource, "waiting_for_lock").Observe(v)
		}))
		rv, err := m.lock(ctx, tx, group, resource)
		lockTimer.ObserveDuration()
		if err != nil {
			span.AddEvent("resource_version_lock_failed", trace.WithAttributes(
				attribute.String("error", err.Error()),
			))
			return fmt.Errorf("failed to increment resource version: %w", err)
		}
		span.AddEvent("resource_version_locked", trace.WithAttributes(
			attribute.Int64("initial_rv", rv),
		))

		rvUpdateTimer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
			rvmExecBatchPhaseDuration.WithLabelValues(group, resource, "update_resource_versions").Observe(v)
		}))
		defer rvUpdateTimer.ObserveDuration()
		// Allocate the RVs
		for i, guid := range guids {
			guidToRV[guid] = rv
			rvs[i] = rv
			rv++
		}
		// Update the resource version for the created resources in both the resource and the resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate: sqltemplate.New(m.dialect),
			GUIDToRV:    guidToRV,
		}); err != nil {
			span.AddEvent("resource_update_rv_failed", trace.WithAttributes(
				attribute.String("error", err.Error()),
			))
			return fmt.Errorf("update resource version: %w", err)
		}
		span.AddEvent("resource_versions_updated")

		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate: sqltemplate.New(m.dialect),
			GUIDToRV:    guidToRV,
		}); err != nil {
			span.AddEvent("resource_history_update_rv_failed", trace.WithAttributes(
				attribute.String("error", err.Error()),
			))
			return fmt.Errorf("update resource history version: %w", err)
		}
		span.AddEvent("resource_history_versions_updated")

		// Record the latest RV in the resource version table
		err = m.saveRV(ctx, tx, group, resource, rv)
		if err != nil {
			span.AddEvent("save_rv_failed", trace.WithAttributes(
				attribute.String("error", err.Error()),
			))
		}
		return err
	})

	if err != nil {
		span.AddEvent("batch_transaction_failed", trace.WithAttributes(
			attribute.String("error", err.Error()),
		))
	} else {
		span.AddEvent("batch_transaction_completed")
	}

	// notify the caller that the operations are done
	for i := range batch {
		batch[i].done <- writeOpResult{
			guid:           guids[i],
			rv:             rvs[i],
			err:            err,
			batchTraceLink: trace.LinkFromContext(ctx),
		}
	}
}

// lock locks the resource version for the given key
func (m *resourceVersionManager) lock(ctx context.Context, x db.ContextExecer, group, resource string) (nextRV int64, err error) {
	// 1. Lock the row and prevent concurrent updates until the transaction is committed
	res, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionGetRequest{
		SQLTemplate: sqltemplate.New(m.dialect),
		Group:       group,
		Resource:    resource,
		Response:    new(resourceVersionResponse),
		ReadOnly:    false, // Lock the row for update
	})

	if errors.Is(err, sql.ErrNoRows) {
		// If there wasn't a row for this resource, create it
		if _, err = dbutil.Exec(ctx, x, sqlResourceVersionInsert, sqlResourceVersionUpsertRequest{
			SQLTemplate: sqltemplate.New(m.dialect),
			Group:       group,
			Resource:    resource,
		}); err != nil {
			return 0, fmt.Errorf("insert into resource_version: %w", err)
		}

		// Fetch the newly created resource version
		res, err = dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionGetRequest{
			SQLTemplate: sqltemplate.New(m.dialect),
			Group:       group,
			Resource:    resource,
			Response:    new(resourceVersionResponse),
			ReadOnly:    true,
		})
		if err != nil {
			return 0, fmt.Errorf("fetching RV after insert: %w", err)
		}
		return res.ResourceVersion, nil
	} else if err != nil {
		return 0, fmt.Errorf("lock the resource version: %w", err)
	}

	return max(res.CurrentEpoch, res.ResourceVersion+1), nil
}

func (m *resourceVersionManager) saveRV(ctx context.Context, x db.ContextExecer, group, resource string, rv int64) error {
	_, err := dbutil.Exec(ctx, x, sqlResourceVersionUpdate, sqlResourceVersionUpsertRequest{
		SQLTemplate:     sqltemplate.New(m.dialect),
		Group:           group,
		Resource:        resource,
		ResourceVersion: rv,
	})
	if err != nil {
		return fmt.Errorf("save resource version: %w", err)
	}
	return nil
}
