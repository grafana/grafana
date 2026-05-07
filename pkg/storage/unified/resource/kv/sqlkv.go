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
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

const (
	DataSection           = "unified/data"
	EventsSection         = "unified/events"
	LastImportTimeSection = "unified/lastimport"
	PendingDeleteSection  = "unified/pendingdelete"
	LeasesSection         = "unified/leases"
)

var _ KV = &SqlKV{}

var sqlKVLog = logging.DefaultLogger.With("logger", "resource-sqlkv")

// DataImportRow represents a single append-only resource_history row written during bulk import.
type DataImportRow struct {
	GUID    string
	KeyPath string
	Value   []byte

	// Legacy stores temporary sql/backend compatibility fields for resource_history.
	// Remove this once sqlkv no longer needs to mirror legacy resource_history columns.
	Legacy *DataImportLegacyFields
}

// DataImportLegacyFields stores the temporary legacy resource_history columns
// needed to keep sqlkv compatible with the old SQL backend during bulk import.
// Remove this once sqlkv no longer needs to mirror legacy resource_history columns.
type DataImportLegacyFields struct {
	Group           string
	Resource        string
	Namespace       string
	Name            string
	Action          int64
	Folder          string
	ResourceVersion int64
	PreviousRV      int64
	Generation      int64
}

type SqlKV struct {
	db         *sql.DB
	dialect    Dialect
	DriverName string // TODO: remove when backwards compatibility is no longer needed.
}

const (
	// Match the existing SQL backend sqlite cap so both bulk import paths chunk the same way.
	dataImportBatchSQLiteMaxRows  = 8
	dataImportBatchDefaultMaxRows = 1000
)

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

func dataImportBatchRowLimit(dialectName string) int {
	if dialectName == "sqlite" {
		return dataImportBatchSQLiteMaxRows
	}

	return dataImportBatchDefaultMaxRows
}

func dataImportBatchStatementCount(rowCount, maxRows int) int {
	if rowCount == 0 || maxRows <= 0 {
		return 0
	}

	return (rowCount + maxRows - 1) / maxRows
}

func dataImportBatchPayloadBytes(rows []DataImportRow) int {
	payloadBytes := 0
	for _, row := range rows {
		payloadBytes += len(row.Value)
	}

	return payloadBytes
}

// conn returns the dbtx from the context (set during bulk import on SQLite)
// or falls back to the default *sql.DB connection pool.
func (k *SqlKV) conn(ctx context.Context) dbtx {
	if db, ok := dbtxFromCtx(ctx); ok {
		return db
	}
	return k.db
}

// InsertDataImportBatch writes a batch of append-only resource_history rows for the bulk import path.
func (k *SqlKV) InsertDataImportBatch(ctx context.Context, rows []DataImportRow) (err error) {
	if len(rows) == 0 {
		return nil
	}

	qb, err := k.getQueryBuilder(DataSection)
	if err != nil {
		return err
	}

	insertStart := time.Now()
	conn := k.conn(ctx)
	var tx *sql.Tx
	usingContextTx := false
	if _, ok := dbtxFromCtx(ctx); !ok {
		tx, err = k.db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin data import transaction: %w", err)
		}
		conn = tx
		defer func() {
			if err != nil {
				err = errors.Join(err, tx.Rollback())
			}
		}()
	} else {
		usingContextTx = true
	}

	maxRows := dataImportBatchRowLimit(k.dialect.Name())
	statementCount := dataImportBatchStatementCount(len(rows), maxRows)
	payloadBytes := dataImportBatchPayloadBytes(rows)
	for start := 0; start < len(rows); start += maxRows {
		end := start + maxRows
		if end > len(rows) {
			end = len(rows)
		}

		query, args, err := qb.buildInsertDatastoreBatchQuery(rows[start:end])
		if err != nil {
			return fmt.Errorf("failed to build data import batch query: %w", err)
		}
		if _, err = conn.ExecContext(ctx, query, args...); err != nil {
			sqlKVLog.Error("sqlkv bulk import insert failed",
				"error", err,
				"dialect", k.dialect.Name(),
				"rows", len(rows),
				"statements", statementCount,
				"max_rows", maxRows,
				"payload_bytes", payloadBytes,
				"using_context_tx", usingContextTx,
			)
			return fmt.Errorf("failed to insert data import batch: %w", err)
		}
	}

	if tx != nil {
		if err = tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit data import batch: %w", err)
		}
	}

	insertDuration := time.Since(insertStart)
	if insertDuration > 500*time.Millisecond {
		sqlKVLog.Warn("slow sqlkv bulk import insert",
			"dialect", k.dialect.Name(),
			"rows", len(rows),
			"statements", statementCount,
			"max_rows", maxRows,
			"payload_bytes", payloadBytes,
			"using_context_tx", usingContextTx,
			"insert", insertDuration,
		)
	} else {
		sqlKVLog.Debug("sqlkv bulk import insert timing",
			"dialect", k.dialect.Name(),
			"rows", len(rows),
			"statements", statementCount,
			"max_rows", maxRows,
			"payload_bytes", payloadBytes,
			"using_context_tx", usingContextTx,
			"insert", insertDuration,
		)
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

	action, err := LegacyActionValue(dataKey.Action)
	if err != nil {
		return err
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

func (k *SqlKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}
	// DataSection maps to resource_history, which has only a non-unique index
	// on key_path, so Create/Update semantics can't be enforced atomically here.
	// This may be lifted once key_path becomes unique on resource_history.
	if section == DataSection {
		return ErrBatchNotSupportedOnDataSection
	}

	if len(ops) == 0 {
		return nil
	}

	if len(ops) > MaxBatchOps {
		return fmt.Errorf("too many operations: %d > %d", len(ops), MaxBatchOps)
	}

	for _, op := range ops {
		if op.Mode != BatchOpDelete && len(op.Value) == 0 {
			return ErrEmptyValue
		}
	}

	qb, err := k.getQueryBuilder(section)
	if err != nil {
		return err
	}

	tx, txErr := k.db.BeginTx(ctx, nil)
	if txErr != nil {
		return fmt.Errorf("failed to begin batch transaction: %w", txErr)
	}
	rollback := func() {
		_ = tx.Rollback()
	}

	for i, op := range ops {
		keyPath := getKeyPath(section, op.Key)

		var opErr error
		switch op.Mode {
		case BatchOpCreate:
			opErr = k.batchInsert(ctx, tx, qb, keyPath, op.Value)
		case BatchOpUpdate:
			opErr = k.batchUpdate(ctx, tx, qb, keyPath, op.Value)
		case BatchOpPut:
			opErr = k.batchPut(ctx, tx, qb, keyPath, op.Value)
		case BatchOpDelete:
			opErr = k.batchDeleteOp(ctx, tx, qb, keyPath)
		default:
			opErr = fmt.Errorf("unknown operation mode: %d", op.Mode)
		}
		if opErr != nil {
			rollback()
			return &BatchError{Err: opErr, Index: i, Op: op}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit batch transaction: %w", err)
	}

	return nil
}

func (k *SqlKV) batchPut(ctx context.Context, conn dbtx, qb *queryBuilder, keyPath string, value []byte) error {
	query, args := qb.buildUpsertQuery(keyPath, value)
	_, err := conn.ExecContext(ctx, query, args...)
	return err
}

func (k *SqlKV) batchDeleteOp(ctx context.Context, conn dbtx, qb *queryBuilder, keyPath string) error {
	query, args := qb.buildDeleteQuery(keyPath)
	_, err := conn.ExecContext(ctx, query, args...)
	return err
}

// batchInsert inserts a new row. Relies on the DB's unique constraint on key_path
// to reject duplicates; the driver error is mapped to ErrKeyAlreadyExists.
func (k *SqlKV) batchInsert(ctx context.Context, conn dbtx, qb *queryBuilder, keyPath string, value []byte) error {
	query, args := qb.buildInsertQuery(keyPath, value)
	if _, err := conn.ExecContext(ctx, query, args...); err != nil {
		if isDuplicateKeyError(err) {
			return ErrKeyAlreadyExists
		}
		return err
	}
	return nil
}

// isDuplicateKeyError reports whether the error is a unique-constraint violation
// from any of the supported SQL drivers (SQLite, PostgreSQL, MySQL).
func isDuplicateKeyError(err error) bool {
	if sqlite.IsUniqueConstraintViolation(err) {
		return true
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}

	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1062
	}

	return false
}

// batchUpdate updates the value for an existing key_path.
// Returns ErrNotFound when the key does not exist (RowsAffected == 0).
func (k *SqlKV) batchUpdate(ctx context.Context, conn dbtx, qb *queryBuilder, keyPath string, value []byte) error {
	query, args := qb.buildUpdateDatastoreQuery(keyPath, value)
	result, err := conn.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
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
