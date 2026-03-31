package kv

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"iter"
	"strings"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

const (
	DataSection           = "unified/data"
	EventsSection         = "unified/events"
	LastImportTimeSection = "unified/lastimport"
	PendingDeleteSection  = "unified/pendingdelete"
)

var _ KV = &SqlKV{}

var batchSavepointCounter uint64

type SqlKV struct {
	db         *sql.DB
	dialect    Dialect
	DriverName string // TODO: remove when backwards compatibility is no longer needed.
}

func NewSQLKV(db *sql.DB, driverName string) (KV, error) {
	if db == nil {
		return nil, fmt.Errorf("db is required")
	}

	dialect, err := DialectFromDriver(driverName)
	if err != nil {
		return nil, err
	}

	return &SqlKV{
		db:         db,
		dialect:    dialect,
		DriverName: driverName, // for usage in datastore
	}, nil
}

// getQueryBuilder creates a query builder for the given section
func (k *SqlKV) getQueryBuilder(section string) (*queryBuilder, error) {
	if section == "" {
		return nil, fmt.Errorf("section is required")
	}

	tableName := ""
	switch section {
	case EventsSection:
		tableName = "resource_events"
	case DataSection:
		tableName = "resource_history"
	case PendingDeleteSection:
		tableName = "pending_tenant_deletions"
	default:
		return nil, fmt.Errorf("invalid section: %s", section)
	}

	return &queryBuilder{
		dialect:   k.dialect,
		tableName: tableName,
	}, nil
}

// getKeyPath constructs a full key path from section and key
func getKeyPath(section, key string) string {
	return section + "/" + key
}

// getKeyPaths constructs full key paths from section and keys
func getKeyPaths(section string, keys []string) []string {
	result := make([]string, len(keys))
	for i, key := range keys {
		result[i] = getKeyPath(section, key)
	}
	return result
}

func (k *SqlKV) Ping(ctx context.Context) error {
	return k.db.PingContext(ctx)
}

// conn returns the dbtx from the context (set during bulk import on SQLite)
// or falls back to the default *sql.DB connection pool.
func (k *SqlKV) conn(ctx context.Context) dbtx {
	if db, ok := dbtxFromCtx(ctx); ok {
		return db
	}
	return k.db
}

// borrowOrBeginTx returns a *sql.Tx for batch operations. When a migration tx
// exists in the context (SQLite bulk import), it is returned directly with
// owned=false so the caller does NOT commit/rollback. Otherwise a new tx is
// started with owned=true and the caller must manage its lifecycle.
func (k *SqlKV) borrowOrBeginTx(ctx context.Context) (tx *sql.Tx, owned bool, err error) {
	if extTx, ok := dbtxFromCtx(ctx); ok {
		if sqlTx, ok := extTx.(*sql.Tx); ok {
			return sqlTx, false, nil
		}
	}
	sqlTx, err := k.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, false, fmt.Errorf("failed to begin transaction: %w", err)
	}
	return sqlTx, true, nil
}

func nextBatchSavepoint() string {
	return fmt.Sprintf("sqlkv_batch_%d", atomic.AddUint64(&batchSavepointCounter, 1))
}

// withBatchTx runs fn inside a transaction and guarantees rollback on error.
// When the context already carries an external *sql.Tx, a savepoint is used so
// Batch remains atomic without owning the outer transaction.
func (k *SqlKV) withBatchTx(ctx context.Context, fn func(context.Context, *sql.Tx) error) error {
	tx, owned, err := k.borrowOrBeginTx(ctx)
	if err != nil {
		return err
	}

	batchCtx := ContextWithDBTX(ctx, tx)
	if owned {
		defer tx.Rollback() //nolint:errcheck
		if err := fn(batchCtx, tx); err != nil {
			return err
		}
		return tx.Commit()
	}

	savepoint := nextBatchSavepoint()
	if _, err := tx.ExecContext(ctx, "SAVEPOINT "+savepoint); err != nil {
		return fmt.Errorf("failed to create savepoint: %w", err)
	}

	if err := fn(batchCtx, tx); err != nil {
		if _, rollbackErr := tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT "+savepoint); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("failed to rollback savepoint: %w", rollbackErr))
		}
		if _, releaseErr := tx.ExecContext(ctx, "RELEASE SAVEPOINT "+savepoint); releaseErr != nil {
			err = errors.Join(err, fmt.Errorf("failed to release savepoint: %w", releaseErr))
		}
		return err
	}

	if _, err := tx.ExecContext(ctx, "RELEASE SAVEPOINT "+savepoint); err != nil {
		return fmt.Errorf("failed to release savepoint: %w", err)
	}
	return nil
}

func (k *SqlKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		if section == LastImportTimeSection {
			k.lastImportTimeKeys(ctx, opt, yield)
			return
		}

		qb, err := k.getQueryBuilder(section)
		if err != nil {
			yield("", err)
			return
		}

		startKey := section + "/" + opt.StartKey
		endKey := opt.EndKey
		if endKey == "" {
			endKey = PrefixRangeEnd(section + "/")
		} else {
			endKey = section + "/" + endKey
		}

		sortAsc := opt.Sort != SortOrderDesc

		query, args := qb.buildKeysQuery(startKey, endKey, sortAsc, opt.Limit)
		rows, err := k.conn(ctx).QueryContext(ctx, query, args...)
		if err != nil {
			yield("", err)
			return
		}
		shouldYield := true
		defer func() { closeRows(rows, yield, shouldYield) }()

		for rows.Next() {
			var key string
			if err := rows.Scan(&key); err != nil {
				shouldYield = yield("", fmt.Errorf("error reading row: %w", err))
				return
			}

			if shouldYield = yield(strings.TrimPrefix(key, section+"/"), nil); !shouldYield {
				return
			}
		}

		if err := rows.Err(); err != nil {
			shouldYield = yield("", fmt.Errorf("failed to read rows: %w", err))
		}
	}
}

func (k *SqlKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	if key == "" {
		return nil, fmt.Errorf("key is required")
	}

	qb, err := k.getQueryBuilder(section)
	if err != nil {
		return nil, err
	}

	keyPath := getKeyPath(section, key)
	query, args := qb.buildGetQuery(keyPath)
	row := k.conn(ctx).QueryRowContext(ctx, query, args...)

	var value []byte
	if err := row.Scan(&value); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get key: %w", err)
	}

	return io.NopCloser(bytes.NewReader(value)), nil
}

func (k *SqlKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	return func(yield func(KeyValue, error) bool) {
		if len(keys) == 0 {
			return
		}

		qb, err := k.getQueryBuilder(section)
		if err != nil {
			yield(KeyValue{}, err)
			return
		}

		keyPaths := getKeyPaths(section, keys)
		query, args := qb.buildBatchGetQuery(keyPaths)
		rows, err := k.conn(ctx).QueryContext(ctx, query, args...)
		if err != nil {
			yield(KeyValue{}, err)
			return
		}
		shouldYield := true
		defer func() { closeRows(rows, yield, shouldYield) }()

		for rows.Next() {
			var key string
			var value []byte
			if err := rows.Scan(&key, &value); err != nil {
				shouldYield = yield(KeyValue{}, fmt.Errorf("error reading row: %w", err))
				return
			}

			kv := KeyValue{
				Key:   strings.TrimPrefix(key, section+"/"),
				Value: io.NopCloser(bytes.NewReader(value)),
			}
			if shouldYield = yield(kv, nil); !shouldYield {
				return
			}
		}

		if err := rows.Err(); err != nil {
			shouldYield = yield(KeyValue{}, fmt.Errorf("failed to read rows: %w", err))
		}
	}
}

func (k *SqlKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	if section == "" {
		return nil, fmt.Errorf("section is required")
	}
	if key == "" {
		return nil, fmt.Errorf("key is required")
	}
	if section != DataSection && section != EventsSection && section != PendingDeleteSection && section != LastImportTimeSection {
		return nil, fmt.Errorf("invalid section: %s", section)
	}

	return &sqlWriteCloser{
		kv:      k,
		ctx:     ctx,
		section: section,
		key:     key,
		buf:     &bytes.Buffer{},
		closed:  false,
	}, nil
}

type sqlWriteCloser struct {
	kv      *SqlKV
	ctx     context.Context
	section string
	key     string
	buf     *bytes.Buffer
	closed  bool
}

func (w *sqlWriteCloser) Write(value []byte) (int, error) {
	if w.closed {
		return 0, errors.New("write to closed writer")
	}

	return w.buf.Write(value)
}

func (w *sqlWriteCloser) Close() error {
	if w.closed {
		return nil
	}

	w.closed = true
	value := w.buf.Bytes()
	if len(value) == 0 {
		return ErrEmptyValue
	}

	if w.section == LastImportTimeSection {
		return w.kv.saveLastImportTime(w.ctx, w.key)
	}

	qb, err := w.kv.getQueryBuilder(w.section)
	if err != nil {
		return err
	}

	keyPath := getKeyPath(w.section, w.key)

	// do regular kv save: simple key_path + value insert with conflict check.
	// can only do this on resource_events and pending_tenant_deletions for now, until we drop the columns in resource_history
	if w.section == EventsSection || w.section == PendingDeleteSection {
		query, args := qb.buildUpsertQuery(keyPath, value)
		_, err := w.kv.conn(w.ctx).ExecContext(w.ctx, query, args...)
		if err != nil {
			return fmt.Errorf("failed to save: %w", err)
		}
		return nil
	}

	// Check if storage_backend injected a transaction (for backward-compatibility mode)
	tx, ok := TxFromCtx(w.ctx)
	if !ok {
		// Non-backwards-compatible mode: simple insert/update
		// This can be simplified once resource_history columns are dropped
		_, err := w.kv.Get(w.ctx, w.section, w.key)
		if errors.Is(err, ErrNotFound) {
			query, args := qb.buildInsertDatastoreQuery(keyPath, value, uuid.New().String())
			_, err := w.kv.conn(w.ctx).ExecContext(w.ctx, query, args...)
			if err != nil {
				return fmt.Errorf("failed to insert to datastore: %w", err)
			}
			return nil
		}

		if err != nil {
			return fmt.Errorf("failed to get for save: %w", err)
		}

		query, args := qb.buildUpdateDatastoreQuery(keyPath, value)
		_, err = w.kv.conn(w.ctx).ExecContext(w.ctx, query, args...)
		if err != nil {
			return fmt.Errorf("failed to update to datastore: %w", err)
		}

		return nil
	}

	// special, temporary backwards-compatible save that includes all the fields in resource_history that are not relevant
	// for the kvstore. This is only called if an RvManager was passed to storage_backend, as that
	// component will be responsible for populating the resource_version and key_path columns.
	// For full backwards-compatibility, the `Save` function needs to be called within a callback that updates the resource_history
	// table with `previous_resource_version` and `generation` and updates the `resource` table accordingly. See the
	// storage_backend for the full implementation.
	// the `resource` table is updated in datastore.go applyBackwardsCompatibleChanges method
	dataKey, err := ParseKeyWithGUID(w.key)
	if err != nil {
		return fmt.Errorf("failed to parse key for GUID: %w", err)
	}

	var action int64
	switch dataKey.Action {
	case DataActionCreated:
		action = 1
	case DataActionUpdated:
		action = 2
	case DataActionDeleted:
		action = 3
	}

	query, args := qb.buildInsertDatastoreBackwardCompatQuery(value, dataKey.GUID, dataKey.Group, dataKey.Resource, dataKey.Namespace, dataKey.Name, dataKey.Folder, action)
	_, err = tx.ExecContext(w.ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to save to resource_history: %w", err)
	}

	return nil
}

func (k *SqlKV) Delete(ctx context.Context, section string, key string) error {
	if key == "" {
		return fmt.Errorf("key is required")
	}

	if section == LastImportTimeSection {
		return k.deleteLastImportTime(ctx, key)
	}

	qb, err := k.getQueryBuilder(section)
	if err != nil {
		return err
	}

	keyPath := getKeyPath(section, key)
	query, args := qb.buildDeleteQuery(keyPath)
	_, err = k.conn(ctx).ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete key: %w", err)
	}

	return nil
}

func (k *SqlKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	qb, err := k.getQueryBuilder(section)
	if err != nil {
		return err
	}

	keyPaths := getKeyPaths(section, keys)
	query, args := qb.buildBatchDeleteQuery(keyPaths)
	if _, err := k.conn(ctx).ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("failed to batch delete keys: %w", err)
	}

	return nil
}

// ImportHistory appends authoritative DataSection history rows for migrator-driven
// bulk imports. It bypasses generic KV.Batch semantics and only performs raw
// datastore inserts inside one transaction/savepoint scope, preserving the
// caller's row order.
func (k *SqlKV) ImportHistory(ctx context.Context, rows []HistoryImportRow) error {
	if len(rows) == 0 {
		return nil
	}

	qb, err := k.getQueryBuilder(DataSection)
	if err != nil {
		return err
	}

	return k.withBatchTx(ctx, func(batchCtx context.Context, tx *sql.Tx) error {
		return k.batchInsertDatastoreRows(batchCtx, tx, qb, rows)
	})
}

func (k *SqlKV) keyExists(ctx context.Context, section string, key string) (bool, error) {
	qb, err := k.getQueryBuilder(section)
	if err != nil {
		return false, err
	}

	query, args := qb.buildExistsQuery(getKeyPath(section, key))
	var exists int
	if err := k.conn(ctx).QueryRowContext(ctx, query, args...).Scan(&exists); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check key existence: %w", err)
	}

	return true, nil
}

// Batch executes a batch of operations. All-Create on DataSection uses multi-row
// INSERT for maximum throughput. Everything else falls back to per-item Save/Delete.
func (k *SqlKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}
	if len(ops) == 0 {
		return nil
	}
	if len(ops) > MaxBatchOps {
		return fmt.Errorf("too many operations: %d > %d", len(ops), MaxBatchOps)
	}

	for i, op := range ops {
		switch op.Mode {
		case BatchOpPut, BatchOpCreate, BatchOpUpdate:
			if len(op.Value) == 0 {
				return &BatchError{Err: ErrEmptyValue, Index: i, Op: op}
			}
		case BatchOpDelete:
			// OK
		default:
			return &BatchError{Err: fmt.Errorf("unknown operation mode: %d", op.Mode), Index: i, Op: op}
		}
	}

	// Fast path: all-Create on DataSection uses multi-row INSERT.
	if section == DataSection && allCreate(ops) {
		qb, err := k.getQueryBuilder(section)
		if err != nil {
			return err
		}
		return k.withBatchTx(ctx, func(batchCtx context.Context, tx *sql.Tx) error {
			return k.batchInsertDatastore(batchCtx, tx, qb, ops)
		})
	}

	return k.withBatchTx(ctx, func(batchCtx context.Context, _ *sql.Tx) error {
		// Fallback: execute per-item semantics via Save/Delete inside one tx.
		for i, op := range ops {
			switch op.Mode {
			case BatchOpCreate:
				exists, err := k.keyExists(batchCtx, section, op.Key)
				if err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
				if exists {
					return &BatchError{Err: ErrKeyAlreadyExists, Index: i, Op: op}
				}
				if err := k.batchWrite(batchCtx, section, op); err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
			case BatchOpUpdate:
				exists, err := k.keyExists(batchCtx, section, op.Key)
				if err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
				if !exists {
					return &BatchError{Err: ErrNotFound, Index: i, Op: op}
				}
				if err := k.batchWrite(batchCtx, section, op); err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
			case BatchOpPut:
				if err := k.batchWrite(batchCtx, section, op); err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
			case BatchOpDelete:
				if err := k.Delete(batchCtx, section, op.Key); err != nil {
					return &BatchError{Err: err, Index: i, Op: op}
				}
			}
		}
		return nil
	})
}

// allCreate returns true if every op is a BatchOpCreate.
func allCreate(ops []BatchOp) bool {
	for _, op := range ops {
		if op.Mode != BatchOpCreate {
			return false
		}
	}
	return true
}

func (k *SqlKV) batchWrite(ctx context.Context, section string, op BatchOp) error {
	w, err := k.Save(ctx, section, op.Key)
	if err != nil {
		return err
	}
	if _, err := w.Write(op.Value); err != nil {
		return err
	}
	return w.Close()
}

func (k *SqlKV) batchInsertDatastore(ctx context.Context, tx *sql.Tx, qb *queryBuilder, ops []BatchOp) error {
	rows := make([]HistoryImportRow, len(ops))
	for i, op := range ops {
		rows[i] = HistoryImportRow{
			Key:   op.Key,
			Value: op.Value,
		}
	}
	return k.batchInsertDatastoreRows(ctx, tx, qb, rows)
}

func (k *SqlKV) batchInsertDatastoreRows(ctx context.Context, tx *sql.Tx, qb *queryBuilder, rows []HistoryImportRow) error {
	maxRows := BatchInsertMaxRows(k.dialect, 9) // 9 params per row
	for start := 0; start < len(rows); start += maxRows {
		end := start + maxRows
		if end > len(rows) {
			end = len(rows)
		}
		chunk := rows[start:end]

		insertRows := make([]batchInsertRow, len(chunk))
		for i, row := range chunk {
			insertRows[i] = batchInsertRow{
				GUID:    uuid.New().String(),
				KeyPath: getKeyPath(DataSection, row.Key),
				Value:   row.Value,
			}
		}

		query, args := qb.buildBatchInsertDatastoreQuery(insertRows)
		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return fmt.Errorf("batch insert failed at rows %d-%d: %w", start, end-1, err)
		}
	}
	return nil
}

func (k *SqlKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return time.Now().Unix(), nil
}

func closeRows[T any](rows *sql.Rows, yield func(T, error) bool, shouldYield bool) {
	if err := rows.Close(); err != nil && shouldYield {
		var zero T
		yield(zero, fmt.Errorf("error closing rows: %w", err))
	}
}
