package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// resourceVersionManager handles resource version operations
type resourceVersionManager struct {
	dialect sqltemplate.Dialect
	db      db.DB
	tracer  trace.Tracer
	batchMu sync.RWMutex
	batchCh map[string]chan *writeOp

	maxBatchSize     int
	maxBatchWaitTime time.Duration
}

type writeOpResult struct {
	guid string
	rv   int64
	err  error
}

// writeOp is a write operation that is executed with an incremented resource version
type writeOp struct {
	key  *resource.ResourceKey // The key of the resource
	fn   WriteEventFunc        // The function to execute to write the event
	done chan writeOpResult    // A channel informing the operation is done
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
		opts.MaxBatchSize = 20
	}
	if opts.MaxBatchWaitTime == 0 {
		opts.MaxBatchWaitTime = 5 * time.Millisecond
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
		batchCh:          make(map[string]chan *writeOp),
		maxBatchSize:     opts.MaxBatchSize,
		maxBatchWaitTime: opts.MaxBatchWaitTime,
	}, nil
}

// ExecWithRV executes the given function with an incremented resource version
func (m *resourceVersionManager) ExecWithRV(ctx context.Context, key *resource.ResourceKey, fn WriteEventFunc) (rv int64, err error) {
	ctx, span := m.tracer.Start(ctx, "ExecWithRV")
	defer span.End()

	span.SetAttributes(
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
	)
	op := writeOp{key: key, fn: fn, done: make(chan writeOpResult, 1)}
	batchKey := fmt.Sprintf("%s/%s", key.Group, key.Resource)

	m.batchMu.Lock()
	ch, ok := m.batchCh[batchKey]
	if !ok {
		ch = make(chan *writeOp, m.maxBatchSize)
		m.batchCh[batchKey] = ch
		go m.startBatchProcessor(key.Group, key.Resource)
	}
	m.batchMu.Unlock()
	ch <- &op
	select {
	case res := <-op.done:
		if res.err != nil {
			span.RecordError(res.err)
		}
		span.SetAttributes(attribute.String("guid", res.guid))
		span.SetAttributes(attribute.Int64("resource_version", res.rv))
		return res.rv, res.err
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

// startBatchProcessor is responsible for processing batches of write operations
func (m *resourceVersionManager) startBatchProcessor(group, resource string) {
	ctx := context.Background() // TODO: use the underlying context
	batchKey := fmt.Sprintf("%s/%s", group, resource)

	m.batchMu.Lock()
	ch, ok := m.batchCh[batchKey]
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

		// wait for the batch to be ready
		batchReady := false
		timeout := time.After(m.maxBatchWaitTime)
		for !batchReady {
			select {
			case op := <-ch:
				batch = append(batch, *op)
				if len(batch) >= m.maxBatchSize {
					batchReady = true
				}
			case <-timeout:
				batchReady = true
			}
		}
		go m.execBatch(ctx, group, resource, batch)
	}
}

func (m *resourceVersionManager) execBatch(ctx context.Context, group, resource string, batch []writeOp) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	guidToRV := make(map[string]int64, len(batch))
	guids := make([]string, len(batch)) // The GUIDs of the created resources in the same order as the batch
	rvs := make([]int64, len(batch))    // The RVs of the created resources in the same order as the batch

	err := m.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		for i := range batch {
			guid, err := batch[i].fn(tx)
			if err != nil {
				return fmt.Errorf("failed to execute function: %w", err)
			}
			guids[i] = guid
		}

		rv, err := m.lock(ctx, tx, group, resource)
		if err != nil {
			return fmt.Errorf("failed to increment resource version: %w", err)
		}
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
			return fmt.Errorf("update resource version: %w", err)
		}
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate: sqltemplate.New(m.dialect),
			GUIDToRV:    guidToRV,
		}); err != nil {
			return fmt.Errorf("update resource history version: %w", err)
		}
		// Record the latest RV in the resource version table
		return m.saveRV(ctx, tx, group, resource, rv)
	})

	// notify the caller that the operations are done
	for i := range batch {
		batch[i].done <- writeOpResult{
			guid: guids[i],
			rv:   rvs[i],
			err:  err,
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
