package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ resource.BulkProcessingBackend = (*backend)(nil)
)

const (
	bulkHistoryInsertSQLiteMaxRows  = 8
	bulkHistoryInsertDefaultMaxRows = 1000

	// analyzeResourceHistoryRowThreshold is the number of rows bulk-loaded into
	// resource_history to trigger an ANALYZE before the resource backfill.
	analyzeResourceHistoryRowThreshold = 10000

	// txChunkerMaxRows forces a chunk commit at this row count as safety cap.
	txChunkerMaxRows = 100_000
)

// noRollbackTx wraps a db.Tx but makes Rollback() a no-op.
// Used for external (migration) transactions where we want to keep the
// transaction alive on failure so the caller can retry with parquet buffering.
type noRollbackTx struct {
	db.Tx
}

func (t *noRollbackTx) Rollback() error { return nil }

type bulkRV struct {
	max     int64
	counter int64
}

// When executing a bulk import we can fake the RV values
func newBulkRV() *bulkRV {
	t := time.Now().Truncate(time.Second * 10)
	return &bulkRV{
		max:     (t.UnixMicro() / 10000000) * 10000000,
		counter: 0,
	}
}

func (x *bulkRV) next(obj metav1.Object) int64 {
	ts := obj.GetCreationTimestamp().UnixMicro()
	anno := obj.GetAnnotations()
	if anno != nil {
		v := anno[utils.AnnoKeyUpdatedTimestamp]
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			ts = t.UnixMicro()
		}
	}
	if ts > x.max || ts < 10000000 {
		ts = x.max
	}
	x.counter++
	return (ts/10000000)*10000000 + x.counter
}

type bulkLock struct {
	running map[string]bool
	mu      sync.Mutex
}

func (x *bulkLock) Start(keys []*resourcepb.ResourceKey) error {
	x.mu.Lock()
	defer x.mu.Unlock()

	// First verify that it is not already running
	ids := make([]string, len(keys))
	for i, k := range keys {
		id := resource.NSGR(k)
		if x.running[id] {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Code:    http.StatusPreconditionFailed,
				Message: "bulk export is already running",
			}}
		}
		ids[i] = id
	}

	// Then add the keys to the lock
	for _, k := range ids {
		x.running[k] = true
	}
	return nil
}

func (x *bulkLock) Finish(keys []*resourcepb.ResourceKey) {
	x.mu.Lock()
	defer x.mu.Unlock()
	for _, k := range keys {
		delete(x.running, resource.NSGR(k))
	}
}

func (x *bulkLock) Active() bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	return len(x.running) > 0
}

// buildKeyPath constructs the key_path for a bulk import entry.
// The format matches the key_path used in normal write operations.
func buildKeyPath(key *resourcepb.ResourceKey, rv int64, action resourcepb.BulkRequest_Action, folder string) string {
	var actionStr string
	switch action {
	case resourcepb.BulkRequest_ADDED:
		actionStr = "created"
	case resourcepb.BulkRequest_MODIFIED:
		actionStr = "updated"
	case resourcepb.BulkRequest_DELETED:
		actionStr = "deleted"
	default:
		actionStr = fmt.Sprintf("%d", action)
	}
	snowflakeRV := rvmanager.SnowflakeFromRV(rv)
	if key.Namespace == "" {
		return fmt.Sprintf("unified/data/%s/%s/%s/%d~%s~%s",
			key.Group, key.Resource, key.Name, snowflakeRV, actionStr, folder)
	}

	return fmt.Sprintf("unified/data/%s/%s/%s/%s/%d~%s~%s",
		key.Group, key.Resource, key.Namespace, key.Name, snowflakeRV, actionStr, folder)
}

func (b *backend) ProcessBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	b.logCall("ProcessBulk")
	if b.disableStorageServices {
		return &resourcepb.BulkResponse{
			Error: resource.AsErrorResult(errors.New("storage backend is not enabled")),
		}
	}
	err := b.bulkLock.Start(setting.Collection)
	if err != nil {
		return &resourcepb.BulkResponse{
			Error: resource.AsErrorResult(err),
		}
	}
	defer b.bulkLock.Finish(setting.Collection)

	// Use a temporary Parquet file to separate read and write phases for SQLite.
	// This avoids lock contention between the SHARED lock held by legacy row cursors
	// and the EXCLUSIVE lock needed for cache spills during bulk inserts.
	// Enabled via config (migration_parquet_buffer) or context (retry after failure).
	useParquet := b.migrationParquetBuffer
	clientCtx := inprocgrpc.ClientContext(ctx) // inprocgrpc contains the migrator context
	if !useParquet && clientCtx != nil {
		useParquet = resource.ParquetBufferFromContext(clientCtx)
	}
	if useParquet && b.dialect.DialectName() == "sqlite" {
		if b.tmpDir != "" {
			if err := os.MkdirAll(b.tmpDir, 0750); err != nil {
				return &resourcepb.BulkResponse{
					Error: resource.AsErrorResult(fmt.Errorf("create tmp dir: %w", err)),
				}
			}
		}
		file, err := os.CreateTemp(b.tmpDir, "grafana-bulk-export-*.parquet")
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}
		defer func() {
			// Close is best-effort; the parquet writer may have already closed the file.
			_ = file.Close()
			if err := os.Remove(file.Name()); err != nil && !os.IsNotExist(err) {
				b.log.Warn("failed to remove parquet tmp file", "path", file.Name(), "err", err)
			}
		}()

		writer, err := parquet.NewParquetWriter(file)
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}

		// write bulk to parquet (ProcessBulk closes the file via writer.Close)
		rsp := writer.ProcessBulk(ctx, setting, iter)
		if rsp.Error != nil {
			return rsp
		}

		b.log.Info("using parquet buffer", "path", file.Name(), "processed", rsp.Processed)

		// Replace the iterator with one from parquet
		iter, err = parquet.NewParquetReader(file.Name(), 50)
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}
	}

	if clientCtx != nil && b.dialect.DialectName() == "sqlite" {
		if externalTx := resource.TransactionFromContext(clientCtx); externalTx != nil {
			b.log.Info("Using SQLite transaction from client context")
			rsp := &resourcepb.BulkResponse{}
			// Let migrator rollback its transaction on error
			tx := &noRollbackTx{dbimpl.NewTx(externalTx)}
			err := b.processBulkWithTx(ctx, tx, setting, iter, rsp)
			if err != nil {
				rsp.Error = resource.AsErrorResult(err)
			}
			return rsp
		}
	}

	if b.migrationChunkedWrites && b.dialect.DialectName() != "sqlite" {
		return b.processBulkChunked(ctx, setting, iter)
	}

	return b.processBulk(ctx, setting, iter)
}

// internal bulk process
func (b *backend) processBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	rsp := &resourcepb.BulkResponse{}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		return b.processBulkWithTx(ctx, tx, setting, iter, rsp)
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}

// processBulkWithTx performs the bulk operation using the provided transaction.
// This is used both when creating our own transaction and when reusing an external one.
func (b *backend) processBulkWithTx(ctx context.Context, tx db.Tx, setting resource.BulkSettings, iter resource.BulkRequestIterator, rsp *resourcepb.BulkResponse) error {
	rollbackWithError := func(err error) error {
		txerr := tx.Rollback()
		if txerr != nil {
			b.log.Warn("rollback", "error", txerr)
		} else {
			b.log.Info("rollback")
		}
		return err
	}
	bulk := &bulkWroker{
		ctx:     ctx,
		tx:      tx,
		dialect: b.dialect,
		logger:  logging.FromContext(ctx),
	}

	// Calculate the RV based on incoming request timestamps
	rv := newBulkRV()
	batchIter, ok := iter.(resource.BulkRequestBatchIterator)
	if !ok {
		batchIter = &singleRequestBatchIterator{iter: iter}
	}

	summaries := make(map[string]*resourcepb.BulkResponse_Summary, len(setting.Collection))

	// First clear everything in the transaction
	for _, key := range setting.Collection {
		summary, err := bulk.deleteCollection(key)
		if err != nil {
			return rollbackWithError(err)
		}
		summaries[resource.NSGR(key)] = summary
		rsp.Summary = append(rsp.Summary, summary)
	}

	// Write each event into the history
	for batchIter.NextBatch() {
		if batchIter.RollbackRequested() {
			return rollbackWithError(nil)
		}
		batch := batchIter.Batch()
		if len(batch) == 0 {
			return rollbackWithError(fmt.Errorf("missing request batch"))
		}
		if _, err := b.insertHistoryBatch(ctx, tx, batch, rv, rsp, nil); err != nil {
			return rollbackWithError(err)
		}
	}

	// Refresh planner stats so syncCollection's self-join avoids a nested-loop plan.
	if err := b.analyzeResourceHistoryForBackfill(ctx, tx, rsp.Processed); err != nil {
		return rollbackWithError(err)
	}

	// Now update the resource table from history
	for _, key := range setting.Collection {
		k := fmt.Sprintf("%s/%s/%s", key.Namespace, key.Group, key.Resource)
		summary := summaries[k]
		if summary == nil {
			return rollbackWithError(fmt.Errorf("missing summary key for: %s", k))
		}

		if err := bulk.syncCollection(key, summary); err != nil {
			return err
		}

		if b.dialect.DialectName() == "sqlite" {
			nextRV, err := b.rvManager.Lock(ctx, tx, key.Group, key.Resource)
			if err != nil {
				b.log.Error("error locking RV", "error", err, "key", resource.NSGR(key))
			} else {
				b.log.Info("successfully locked RV", "nextRV", nextRV, "key", resource.NSGR(key))
				// Save the incremented RV
				if err := b.rvManager.SaveRV(ctx, tx, key.Group, key.Resource, nextRV); err != nil {
					b.log.Error("error saving RV", "error", err, "key", resource.NSGR(key))
				} else {
					b.log.Info("successfully saved RV", "rv", nextRV, "key", resource.NSGR(key))
				}
			}
		} else {
			// Make sure the collection RV is above our last written event
			_, err := b.rvManager.ExecWithRV(ctx, key, func(_ context.Context, _ db.Tx) (string, error) {
				return "", nil
			})
			if err != nil {
				b.log.Warn("error increasing RV", "error", err)
			}
		}

		// Update the last import time. This is important to trigger reindexing
		// of the resource for a given namespace.
		if err := b.updateLastImportTime(ctx, tx, key, time.Now()); err != nil {
			return rollbackWithError(err)
		}
	}
	return nil
}

// processBulkChunked mirrors processBulkWithTx but uses multiple txs and autocommit.
//
// Note: mid-stream rollback is not possible. A RollbackRequested signal or error
// returns a hard error after best-effort re-wiping the committed chunks.
func (b *backend) processBulkChunked(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	rsp := &resourcepb.BulkResponse{}
	budget := b.migrationChunkMaxBytes

	// Clear each collection using bounded autocommit batches.
	summaries := make(map[string]*resourcepb.BulkResponse_Summary, len(setting.Collection))
	for _, key := range setting.Collection {
		summary, err := b.deleteCollectionChunked(ctx, key)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp
		}
		summaries[resource.NSGR(key)] = summary
		rsp.Summary = append(rsp.Summary, summary)
	}

	if err := b.writeBulkChunked(ctx, setting, iter, rsp, summaries, budget); err != nil {
		// Best-effort re-wipe of the partially committed collections.
		for _, key := range setting.Collection {
			if _, derr := b.deleteCollectionChunked(ctx, key); derr != nil {
				b.log.Warn("cleanup after failed chunked migration", "key", resource.NSGR(key), "error", derr)
			}
		}
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	return rsp
}

// txChunker owns a sequence of bounded transactions on a db.DB. Callers Exec
// against the open tx field and report work via add(); it commits and reopens
// once pending bytes reach the budget or rows reach maxRows. flush commits the
// last tx. Not safe for concurrent use.
type txChunker struct {
	ctx      context.Context
	db       db.DB
	opts     *sql.TxOptions
	budget   int64             // commit when pendingBytes >= budget
	maxRows  int               // forced commit when pendingRows >= maxRows
	onCommit func(bytes int64) // optional, fired after each committed chunk that had work

	tx           db.Tx // open transaction; nil after a commit/begin error
	pendingBytes int64
	pendingRows  int
}

// newTxChunker falls back to the default budget when non-positive and begins the
// first transaction.
func newTxChunker(ctx context.Context, database db.DB, opts *sql.TxOptions, budget int64, maxRows int, onCommit func(int64)) (*txChunker, error) {
	if budget <= 0 {
		budget = defaultChunkBudget
	}
	tx, err := database.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &txChunker{ctx: ctx, db: database, opts: opts, budget: budget, maxRows: maxRows, onCommit: onCommit, tx: tx}, nil
}

// commit commits the open tx (firing onCommit when it held work) and resets the
// counters. The chunker holds no open tx afterward.
func (c *txChunker) commit() error {
	if c.tx == nil {
		return nil
	}
	hadWork := c.pendingRows > 0
	err := c.tx.Commit()
	c.tx = nil
	if err != nil {
		return err
	}
	if hadWork && c.onCommit != nil {
		c.onCommit(c.pendingBytes)
	}
	c.pendingBytes, c.pendingRows = 0, 0
	return nil
}

// add accumulates the last write's bytes/rows; once the byte budget or row limit
// is reached it commits the chunk and opens a fresh transaction.
func (c *txChunker) add(bytes int64, rows int) error {
	c.pendingBytes += bytes
	c.pendingRows += rows
	if c.pendingBytes >= c.budget || (c.maxRows > 0 && c.pendingRows >= c.maxRows) {
		if err := c.commit(); err != nil {
			return err
		}
		tx, err := c.db.BeginTx(c.ctx, c.opts)
		if err != nil {
			return err
		}
		c.tx = tx
	}
	return nil
}

// abort rolls back the open transaction
func (c *txChunker) abort() error {
	if c.tx == nil {
		return nil
	}
	err := c.tx.Rollback()
	c.tx = nil
	return err
}

// writeBulkChunked stream history in chunks, refresh stats, and
// then backfill the resource table using name ranges.
func (b *backend) writeBulkChunked(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator, rsp *resourcepb.BulkResponse, summaries map[string]*resourcepb.BulkResponse_Summary, budget int64) error {
	// Write each event into history, committed per chunk.
	rv := newBulkRV()
	batchIter, ok := iter.(resource.BulkRequestBatchIterator)
	if !ok {
		batchIter = &singleRequestBatchIterator{iter: iter}
	}

	// colSizes accumulates max-RV row size per NSGR
	// for backfill with budget without a second pass.
	colSizes := map[string]backfillSizes{}

	var onCommit func(int64)
	if b.bulkCommitObserver != nil {
		onCommit = func(bytes int64) {
			b.bulkCommitObserver("history", bytes)
		}
	}
	chunker, err := newTxChunker(ctx, b.db, ReadCommitted, budget, txChunkerMaxRows, onCommit)
	if err != nil {
		return err
	}
	processChunkFn := func() error {
		if batchIter.RollbackRequested() {
			return fmt.Errorf("bulk migration rollback requested (best-effort)")
		}
		batch := batchIter.Batch()
		if len(batch) == 0 {
			if err := chunker.abort(); err != nil {
				b.log.Warn("rollback", "error", err)
			}
			return fmt.Errorf("missing request batch")
		}
		bytes, err := b.insertHistoryBatch(ctx, chunker.tx, batch, rv, rsp, colSizes)
		if err != nil {
			return err
		}
		return chunker.add(int64(bytes), len(batch))
	}

	for batchIter.NextBatch() {
		if err := processChunkFn(); err != nil {
			if abortErr := chunker.abort(); abortErr != nil {
				b.log.Warn("rollback", "error", err, "aborting", abortErr)
			}
			return err
		}
	}
	if err := chunker.commit(); err != nil {
		return err
	}

	// Refresh planner stats so backfill avoids a nested-loop plan.
	if err := b.analyzeResourceHistoryForBackfill(ctx, b.db, rsp.Processed); err != nil {
		return err
	}

	// Backfill the resource table from history and finalize
	worker := &bulkWroker{
		ctx:     ctx,
		tx:      b.db,
		dialect: b.dialect,
		logger:  logging.FromContext(ctx),
	}
	for _, key := range setting.Collection {
		k := resource.NSGR(key)
		summary := summaries[k]
		if summary == nil {
			return fmt.Errorf("missing summary key for: %s", k)
		}

		// Paginated INSERT...SELECT backfill: split the rebuild into
		// byte-bounded name ranges so no single write-set exceeds the budget.
		sizes := colSizes[k]
		sizeOf := func(name string) int64 {
			ns := sizes[name]
			if ns == nil || ns.deleted {
				return 0
			}
			return int64(ns.size)
		}

		names, err := dbutil.Query(ctx, b.db, sqlResourceHistoryDistinctNames, &sqlResourceHistoryDistinctNamesRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Namespace:   key.Namespace,
			Group:       key.Group,
			Resource:    key.Resource,
			Response:    new(distinctName),
		})
		if err != nil {
			return err
		}
		nameList := make([]string, len(names))
		for i, n := range names {
			nameList[i] = n.Name
		}

		for _, r := range planNameRanges(nameList, sizeOf, budget) {
			if err := worker.insertFromHistoryRange(key, r.startName, r.endName); err != nil {
				return err
			}
			if b.bulkCommitObserver != nil {
				b.bulkCommitObserver("backfill", r.plannedBytes)
			}
		}

		if err := worker.collectStats(key, summary); err != nil {
			return err
		}

		// Bump the collection RV above our last written event. It manages its own
		// transaction, so a failure is warn-only as in processBulkWithTx.
		if _, err := b.rvManager.ExecWithRV(ctx, key, func(_ context.Context, _ db.Tx) (string, error) {
			return "", nil
		}); err != nil {
			b.log.Warn("error increasing RV", "error", err)
		}

		// Update the last import time LAST. This is important to trigger
		// reindexing of the resource for a given namespace.
		if err := b.updateLastImportTime(ctx, b.db, key, time.Now()); err != nil {
			return err
		}
	}
	return nil
}

// analyzeResourceHistoryForBackfill exists because syncCollection's self-join would otherwise
// run against stale statistics: resource_history was just bulk-loaded in this same transaction,
// so the planner still sees it as empty and picks an O(n^2) nested-loop plan that never finishes
// on large rebuilds.
func (b *backend) analyzeResourceHistoryForBackfill(ctx context.Context, tx db.ContextExecer, processed int64) error {
	if b.dialect.DialectName() != "postgres" || processed < int64(b.analyzeBulkRowThreshold) {
		return nil
	}
	table, err := b.dialect.Ident("resource_history")
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "ANALYZE "+table)
	return err
}

// nameMaxRow records the byte size and delete flag of the highest-RV row seen
// for a name. The backfill copies that row, so size is the name's write-set cost.
type nameMaxRow struct {
	rv      int64
	size    int
	deleted bool
}

// backfillSizes maps a name to its max-RV row summary for a single collection.
type backfillSizes map[string]*nameMaxRow

// observe keeps the highest-RV row for name, recording its size and delete flag.
func (s backfillSizes) observe(name string, resourceVersion int64, size int, deleted bool) {
	cur, ok := s[name]
	if !ok {
		s[name] = &nameMaxRow{rv: resourceVersion, size: size, deleted: deleted}
		return
	}
	if resourceVersion > cur.rv {
		cur.rv = resourceVersion
		cur.size = size
		cur.deleted = deleted
	}
}

// insertHistoryBatch inserts a batch of history rows. When colSizes is non-nil
// (chunked path), it records per-name max-RV value size and delete flag.
func (b *backend) insertHistoryBatch(ctx context.Context, tx db.ContextExecer, batch []*resourcepb.BulkRequest, rv *bulkRV, rsp *resourcepb.BulkResponse, colSizes map[string]backfillSizes) (int, error) {
	rows := make([]sqlResourceRequest, 0, len(batch))
	payloadBytes := 0
	for _, req := range batch {
		if req == nil {
			return 0, fmt.Errorf("missing request")
		}
		rsp.Processed++
		payloadBytes += len(req.Value)

		if req.Action == resourcepb.BulkRequest_UNKNOWN {
			rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
				Key:    req.Key,
				Action: req.Action,
				Error:  "unknown action",
			})
			continue
		}

		obj := &unstructured.Unstructured{}
		if err := obj.UnmarshalJSON(req.Value); err != nil {
			rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
				Key:    req.Key,
				Action: req.Action,
				Error:  fmt.Sprintf("unable to unmarshal json (bulk): %s", err.Error()),
			})
			continue
		}

		resourceVersion := rv.next(obj)
		if colSizes != nil {
			nsgr := resource.NSGR(req.Key)
			sizes := colSizes[nsgr]
			if sizes == nil {
				sizes = backfillSizes{}
				colSizes[nsgr] = sizes
			}
			sizes.observe(req.Key.Name, resourceVersion, len(req.Value), req.Action == resourcepb.BulkRequest_DELETED)
		}
		rows = append(rows, sqlResourceRequest{
			WriteEvent: resource.WriteEvent{
				Key:        req.Key,
				Type:       resourcepb.WatchEvent_Type(req.Action),
				Value:      req.Value,
				PreviousRV: -1, // Used for WATCH, but we want to skip watch events
			},
			Folder:          req.Folder,
			GUID:            uuid.New().String(),
			ResourceVersion: resourceVersion,
			KeyPath:         buildKeyPath(req.Key, resourceVersion, req.Action, req.Folder),
		})
	}

	if len(rows) == 0 {
		return payloadBytes, nil
	}

	insertStart := time.Now()
	maxRows := bulkHistoryInsertRowLimit(b.dialect.DialectName())
	for start := 0; start < len(rows); start += maxRows {
		end := start + maxRows
		if end > len(rows) {
			end = len(rows)
		}
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsertBulk, sqlBulkResourceHistoryInsertRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Rows:        rows[start:end],
		}); err != nil {
			return payloadBytes, fmt.Errorf("insert into resource history: %w", err)
		}
	}
	insertDuration := time.Since(insertStart)

	if insertDuration > 500*time.Millisecond {
		b.log.Warn("slow bulk insert", "processed", rsp.Processed, "batch_size", len(batch), "inserted", len(rows), "payload_bytes", payloadBytes, "insert", insertDuration)
	} else if rsp.Processed%10 == 0 {
		b.log.Debug("bulk insert timing", "processed", rsp.Processed, "batch_size", len(batch), "inserted", len(rows), "payload_bytes", payloadBytes, "insert", insertDuration)
	}

	return payloadBytes, nil
}

func bulkHistoryInsertRowLimit(dialectName string) int {
	switch dialectName {
	case "sqlite":
		return bulkHistoryInsertSQLiteMaxRows
	default:
		return bulkHistoryInsertDefaultMaxRows
	}
}

type singleRequestBatchIterator struct {
	iter  resource.BulkRequestIterator
	batch []*resourcepb.BulkRequest
}

func (s *singleRequestBatchIterator) NextBatch() bool {
	if !s.iter.Next() {
		return false
	}
	if req := s.iter.Request(); req != nil {
		if len(s.batch) == 0 {
			s.batch = make([]*resourcepb.BulkRequest, 1)
		}
		s.batch[0] = req
	} else {
		s.batch = nil
	}
	return true
}

func (s *singleRequestBatchIterator) Batch() []*resourcepb.BulkRequest {
	return s.batch
}

func (s *singleRequestBatchIterator) RollbackRequested() bool {
	return s.iter.RollbackRequested()
}

func (b *backend) updateLastImportTime(ctx context.Context, tx db.ContextExecer, key *resourcepb.ResourceKey, now time.Time) error {
	if _, err := dbutil.Exec(ctx, tx, sqlResourceLastImportTimeInsert, sqlResourceLastImportTimeInsertRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Namespace:      key.Namespace,
		Group:          key.Group,
		Resource:       key.Resource,
		LastImportTime: now.UTC(),
	}); err != nil {
		return fmt.Errorf("insert resource last import time: %w", err)
	}
	return nil
}

type bulkWroker struct {
	ctx     context.Context
	tx      db.ContextExecer
	dialect sqltemplate.Dialect
	logger  logging.Logger
}

// This will remove everything from the `resource` and `resource_history` table for a given namespace/group/resource
func (w *bulkWroker) deleteCollection(key *resourcepb.ResourceKey) (*resourcepb.BulkResponse_Summary, error) {
	summary := &resourcepb.BulkResponse_Summary{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}

	// First delete history
	res, err := dbutil.Exec(w.ctx, w.tx, sqlResourceHistoryDelete, &sqlResourceHistoryDeleteRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Namespace:   key.Namespace,
		Group:       key.Group,
		Resource:    key.Resource,
	})
	if err != nil {
		return nil, err
	}

	summary.PreviousHistory, err = res.RowsAffected()
	if err != nil {
		return nil, err
	}

	// Next delete the active resource table
	res, err = dbutil.Exec(w.ctx, w.tx, sqlResourceDelete, &sqlResourceRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		WriteEvent: resource.WriteEvent{
			Key: key,
		},
	})
	if err != nil {
		return nil, err
	}
	summary.PreviousCount, err = res.RowsAffected()
	return summary, err
}

const (
	// deleteCollectionChunkBatchSize is the number of candidate rows fetched per
	// SELECT during a chunked wipe.
	deleteCollectionChunkBatchSize = 2000
	// defaultChunkBudget (256 MiB) when b.migrationChunkMaxBytes is <= 0 and chunking is enabled.
	defaultChunkBudget = 256 * 1024 * 1024
)

// deleteCollectionChunked clears the resource and resource_history tables for a
// namespace/group/resource in multiple transactions.
func (b *backend) deleteCollectionChunked(ctx context.Context, key *resourcepb.ResourceKey) (*resourcepb.BulkResponse_Summary, error) {
	summary := &resourcepb.BulkResponse_Summary{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}

	// History first, then the active resource table, matching deleteCollection.
	history, err := b.wipeTableChunked(ctx, key, tableResourceHistory)
	if err != nil {
		return nil, err
	}
	summary.PreviousHistory = history

	count, err := b.wipeTableChunked(ctx, key, tableResource)
	if err != nil {
		return nil, err
	}
	summary.PreviousCount = count

	return summary, nil
}

// wipeTableChunked deletes every row for key from the table ("resource"
// or "resource_history") and returns the number of rows deleted.
func (b *backend) wipeTableChunked(ctx context.Context, key *resourcepb.ResourceKey, table string) (int64, error) {
	budget := b.migrationChunkMaxBytes
	if budget <= 0 {
		budget = defaultChunkBudget
	}
	var totalDeleted int64

	for {
		// Get delete candidates and their value sizes to bound each delete's write-set.
		// Read them into a slice (not held open across the deletes) and delete every
		// one before the next SELECT, or the loop won't terminate.
		candidates, err := dbutil.Query(ctx, b.db, sqlChunkCandidates, &sqlChunkCandidatesRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Table:       table,
			Namespace:   key.Namespace,
			Group:       key.Group,
			Resource:    key.Resource,
			BatchSize:   deleteCollectionChunkBatchSize,
			Response:    new(chunkCandidate),
		})
		if err != nil {
			return 0, err
		}
		if len(candidates) == 0 {
			break
		}

		// Greedily group guids into sub-batches whose total value bytes stay under
		// budget; an oversize row goes alone in its own sub-batch.
		var (
			guids   []string
			subSize int64
		)
		flush := func() error {
			if len(guids) == 0 {
				return nil
			}
			res, err := dbutil.Exec(ctx, b.db, sqlDeleteByGUIDs, &sqlDeleteByGUIDsRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Table:       table,
				Namespace:   key.Namespace,
				Group:       key.Group,
				Resource:    key.Resource,
				GUIDs:       guids,
			})
			if err != nil {
				return err
			}
			rows, err := res.RowsAffected()
			if err != nil {
				return err
			}
			totalDeleted += rows
			guids = guids[:0]
			subSize = 0
			return nil
		}

		for _, c := range candidates {
			cost := c.Size
			if len(guids) > 0 && subSize+cost > budget {
				if err := flush(); err != nil {
					return 0, err
				}
			}
			guids = append(guids, c.GUID)
			subSize += cost
		}
		if err := flush(); err != nil {
			return 0, err
		}
	}

	return totalDeleted, nil
}

// syncCollection copies the latest history value into the resource table for the
// whole collection, then records its stats.
func (w *bulkWroker) syncCollection(key *resourcepb.ResourceKey, summary *resourcepb.BulkResponse_Summary) error {
	if err := w.insertFromHistoryRange(key, "", ""); err != nil {
		return err
	}
	return w.collectStats(key, summary)
}

// insertFromHistoryRange copies the latest history value into the resource table
// for names in the half-open range (startName, endName]. An empty bound leaves
// that side unbounded.
func (w *bulkWroker) insertFromHistoryRange(key *resourcepb.ResourceKey, startName, endName string) error {
	w.logger.Info("synchronize collection", "key", resource.NSGR(key))
	_, err := dbutil.Exec(w.ctx, w.tx, sqlResourceInsertFromHistory, &sqlResourceInsertFromHistoryRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Key:         key,
		StartName:   startName,
		EndName:     endName,
	})
	return err
}

// nameRange selects the names for one backfill INSERT...SELECT: those with
// startName < name <= endName. An empty startName/endName means no lower/upper
// bound. plannedBytes is the summed size of those names, for budgeting.
type nameRange struct {
	startName    string
	endName      string
	plannedBytes int64
}

// planNameRanges splits names into contiguous half-open (startName, endName]
// ranges whose summed sizeOf stays within budget, keeping each backfill
// write-set under the byte cap.
//
// names MUST be kept in DB collation order (as returned by the distinct-name query).
//
// The result covers every name exactly once and ends with an unbounded range
// (endName == "") as a catch-all. An empty names slice yields one unbounded
// range, matching the original single-statement backfill.
func planNameRanges(names []string, sizeOf func(name string) int64, budget int64) []nameRange {
	if budget <= 0 {
		budget = defaultChunkBudget
	}
	if len(names) == 0 {
		return []nameRange{{startName: "", endName: ""}}
	}

	var ranges []nameRange
	rangeStart := "" // exclusive lower bound of the current open range
	prev := ""       // most recently accumulated name (acc > 0 ⇒ prev is set)
	var acc int64

	for _, name := range names {
		sz := sizeOf(name)

		// Adding this name would overflow the current non-empty range: close
		// the range at the previous name and start a new one there.
		if acc > 0 && acc+sz > budget {
			ranges = append(ranges, nameRange{startName: rangeStart, endName: prev, plannedBytes: acc})
			rangeStart = prev
			acc = 0
		}
		acc += sz
		prev = name
	}

	// Final range: unbounded above so any name past the last boundary is still
	// copied. It carries the trailing accumulated bytes.
	ranges = append(ranges, nameRange{startName: rangeStart, endName: "", plannedBytes: acc})
	return ranges
}

// collectStats reads the resource stats for the collection and records them in summary.
func (w *bulkWroker) collectStats(key *resourcepb.ResourceKey, summary *resourcepb.BulkResponse_Summary) error {
	w.logger.Info("get stats (still in transaction)", "key", resource.NSGR(key))
	rows, err := dbutil.QueryRows(w.ctx, w.tx, sqlResourceStats, &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Namespace:   key.Namespace,
		Group:       key.Group,
		Resource:    key.Resource,
	})
	if err != nil {
		return err
	}
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if rows.Next() {
		row := resource.ResourceStats{}
		return rows.Scan(&row.Namespace, &row.Group, &row.Resource,
			&summary.Count,
			&summary.ResourceVersion)
	}
	return err
}
