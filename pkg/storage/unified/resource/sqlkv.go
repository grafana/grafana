package resource

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"iter"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const (
	sectionData   = "unified/data"
	sectionEvents = "unified/events"
)

// sqlKV implements the KV interface using SQL storage
type sqlKV struct {
	db      db.DB
	dialect sqltemplate.Dialect
}

// NewSQLKV creates a new SQL-based KV store
func NewSQLKV(dbProvider db.DBProvider) (KV, error) {
	if dbProvider == nil {
		return nil, errors.New("dbProvider is required")
	}

	// Initialize the database connection
	ctx := context.Background()
	dbConn, err := dbProvider.Init(ctx)
	if err != nil {
		return nil, fmt.Errorf("initialize DB: %w", err)
	}

	// Determine the SQL dialect
	var dialect sqltemplate.Dialect
	switch dbConn.DriverName() {
	case "mysql":
		dialect = sqltemplate.MySQL
	case "postgres":
		dialect = sqltemplate.PostgreSQL
	case "sqlite3", "sqlite":
		dialect = sqltemplate.SQLite
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", dbConn.DriverName())
	}

	return &sqlKV{
		db:      dbConn,
		dialect: dialect,
	}, nil
}

// Verify that sqlKV implements KV interface
var _ KV = &sqlKV{}

// Helper function to build identifiers safely
func (k *sqlKV) ident(name string) (string, error) {
	return k.dialect.Ident(name)
}

// Helper function to get table name for a section
func (k *sqlKV) getTableName(section string) (string, error) {
	switch section {
	case sectionData:
		return k.ident("resource_history")
	case sectionEvents:
		return k.ident("resource_events")
	default:
		return "", fmt.Errorf("unsupported section: %s", section)
	}
}

// parsedKey represents the components of a key_path for the data section
// Format: {Group}/{Resource}/{Namespace}/{Name}/{ResourceVersion}~{Action}~{Folder}
type parsedKey struct {
	Group           string
	Resource        string
	Namespace       string
	Name            string
	ResourceVersion int64
	Action          int // 1: create, 2: update, 3: delete
	Folder          string
}

// parseDataKey parses a data section key_path
func parseDataKey(keyPath string) (*parsedKey, error) {
	// Split by ~ to separate main key from action and folder
	parts := strings.Split(keyPath, "~")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid key format: expected 3 parts separated by '~', got %d", len(parts))
	}

	// Split main key by /
	mainParts := strings.Split(parts[0], "/")
	if len(mainParts) != 5 {
		return nil, fmt.Errorf("invalid key format: expected 5 parts separated by '/', got %d", len(mainParts))
	}

	// Parse resource version (stored as snowflake ID in key)
	rv, err := strconv.ParseInt(mainParts[4], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid resource_version: %w", err)
	}

	// Convert action string to int
	var action int
	switch parts[1] {
	case "created":
		action = 1
	case "updated":
		action = 2
	case "deleted":
		action = 3
	default:
		return nil, fmt.Errorf("invalid action: %s", parts[1])
	}

	return &parsedKey{
		Group:           mainParts[0],
		Resource:        mainParts[1],
		Namespace:       mainParts[2],
		Name:            mainParts[3],
		ResourceVersion: rv,
		Action:          action,
		Folder:          parts[2], // May be empty string
	}, nil
}

// Get retrieves the value for a key from the store
func (k *sqlKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	if section == "" {
		return nil, fmt.Errorf("section is required")
	}
	if key == "" {
		return nil, fmt.Errorf("key is required")
	}

	tableName, err := k.getTableName(section)
	if err != nil {
		return nil, err
	}

	valueIdent, err := k.ident("value")
	if err != nil {
		return nil, fmt.Errorf("invalid column identifier: %w", err)
	}
	keyPathIdent, err := k.ident("key_path")
	if err != nil {
		return nil, fmt.Errorf("invalid column identifier: %w", err)
	}

	query := fmt.Sprintf(
		"SELECT %s FROM %s WHERE %s = %s",
		valueIdent,
		tableName,
		keyPathIdent,
		k.dialect.ArgPlaceholder(1),
	)

	// Execute the query
	var value []byte
	err = k.db.QueryRowContext(ctx, query, key).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("query failed: %w", err)
	}

	return io.NopCloser(bytes.NewReader(value)), nil
}

// BatchGet retrieves multiple values for the given keys from the store
// Uses a UNION ALL subquery with LEFT JOIN to preserve order and enable streaming
func (k *sqlKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	if section == "" {
		return func(yield func(KeyValue, error) bool) {
			yield(KeyValue{}, fmt.Errorf("section is required"))
		}
	}

	if len(keys) == 0 {
		return func(yield func(KeyValue, error) bool) {
			// Empty result set - nothing to yield
		}
	}

	return func(yield func(KeyValue, error) bool) {
		tableName, err := k.getTableName(section)
		if err != nil {
			yield(KeyValue{}, err)
			return
		}

		keyPathIdent, err := k.ident("key_path")
		if err != nil {
			yield(KeyValue{}, fmt.Errorf("invalid column identifier: %w", err))
			return
		}

		valueIdent, err := k.ident("value")
		if err != nil {
			yield(KeyValue{}, fmt.Errorf("invalid column identifier: %w", err))
			return
		}

		// Build UNION ALL subquery to preserve key order
		// SELECT 0 AS idx, ? AS kp UNION ALL SELECT 1, ? UNION ALL ...
		var unionParts []string
		var args []interface{}
		argNum := 1

		for i, key := range keys {
			if i == 0 {
				unionParts = append(unionParts, fmt.Sprintf(
					"SELECT %s AS idx, %s AS kp",
					k.dialect.ArgPlaceholder(argNum),
					k.dialect.ArgPlaceholder(argNum+1),
				))
			} else {
				unionParts = append(unionParts, fmt.Sprintf(
					"UNION ALL SELECT %s, %s",
					k.dialect.ArgPlaceholder(argNum),
					k.dialect.ArgPlaceholder(argNum+1),
				))
			}
			args = append(args, i, key)
			argNum += 2
		}

		// Build the full query with LEFT JOIN to preserve order
		// This allows streaming results directly without buffering
		query := fmt.Sprintf(
			"SELECT v.idx, t.%s, t.%s FROM (%s) AS v LEFT JOIN %s t ON t.%s = v.kp ORDER BY v.idx",
			keyPathIdent,
			valueIdent,
			strings.Join(unionParts, " "),
			tableName,
			keyPathIdent,
		)

		// Execute the query
		rows, err := k.db.QueryContext(ctx, query, args...)
		if err != nil {
			yield(KeyValue{}, fmt.Errorf("query failed: %w", err))
			return
		}
		defer rows.Close()

		// Stream results directly - no buffering needed!
		// Results come back in the order specified by idx
		for rows.Next() {
			var idx int
			var keyPath sql.NullString
			var value []byte

			if err := rows.Scan(&idx, &keyPath, &value); err != nil {
				yield(KeyValue{}, fmt.Errorf("scan failed: %w", err))
				return
			}

			// Skip keys that don't exist (LEFT JOIN returns NULL)
			if !keyPath.Valid {
				continue
			}

			kv := KeyValue{
				Key:   keyPath.String,
				Value: io.NopCloser(bytes.NewReader(value)),
			}

			if !yield(kv, nil) {
				return
			}
		}

		if err := rows.Err(); err != nil {
			yield(KeyValue{}, fmt.Errorf("rows error: %w", err))
			return
		}
	}
}

// Keys returns all the keys in the store
func (k *sqlKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	if section == "" {
		return func(yield func(string, error) bool) {
			yield("", fmt.Errorf("section is required"))
		}
	}

	return func(yield func(string, error) bool) {
		tableName, err := k.getTableName(section)
		if err != nil {
			yield("", err)
			return
		}

		keyPathIdent, err := k.ident("key_path")
		if err != nil {
			yield("", fmt.Errorf("invalid column identifier: %w", err))
			return
		}

		// Build WHERE clauses
		var whereClauses []string
		var args []interface{}
		argNum := 1

		// Start key (inclusive)
		if opt.StartKey != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("%s >= %s", keyPathIdent, k.dialect.ArgPlaceholder(argNum)))
			args = append(args, opt.StartKey)
			argNum++
		}

		// End key (exclusive)
		if opt.EndKey != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("%s < %s", keyPathIdent, k.dialect.ArgPlaceholder(argNum)))
			args = append(args, opt.EndKey)
			argNum++
		}

		// Build ORDER BY clause
		orderBy := "ASC"
		if opt.Sort == SortOrderDesc {
			orderBy = "DESC"
		}

		// Build the query
		query := fmt.Sprintf(
			"SELECT %s FROM %s",
			keyPathIdent,
			tableName,
		)

		if len(whereClauses) > 0 {
			query += " WHERE " + strings.Join(whereClauses, " AND ")
		}

		query += fmt.Sprintf(" ORDER BY %s %s", keyPathIdent, orderBy)

		if opt.Limit > 0 {
			query += fmt.Sprintf(" LIMIT %d", opt.Limit)
		}

		// Execute the query
		rows, err := k.db.QueryContext(ctx, query, args...)
		if err != nil {
			yield("", fmt.Errorf("query failed: %w", err))
			return
		}
		defer rows.Close()

		// Yield each key
		for rows.Next() {
			var keyPath string
			if err := rows.Scan(&keyPath); err != nil {
				yield("", fmt.Errorf("scan failed: %w", err))
				return
			}
			if !yield(keyPath, nil) {
				return
			}
		}

		if err := rows.Err(); err != nil {
			yield("", fmt.Errorf("rows error: %w", err))
			return
		}
	}
}

// Save a new value - returns a WriteCloser to write the value to
func (k *sqlKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	if section == "" {
		return nil, fmt.Errorf("section is required")
	}
	if key == "" {
		return nil, fmt.Errorf("key is required")
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

// sqlWriteCloser implements io.WriteCloser for SQL KV Save operations
type sqlWriteCloser struct {
	kv      *sqlKV
	ctx     context.Context
	section string
	key     string
	buf     *bytes.Buffer
	closed  bool
}

// Write implements io.Writer
func (w *sqlWriteCloser) Write(p []byte) (int, error) {
	if w.closed {
		return 0, fmt.Errorf("write to closed writer")
	}
	return w.buf.Write(p)
}

// Close implements io.Closer - stores the buffered data in SQL
func (w *sqlWriteCloser) Close() error {
	if w.closed {
		return nil
	}
	w.closed = true

	value := w.buf.Bytes()

	switch w.section {
	case sectionEvents:
		// Simple upsert for events section
		return w.closeEvents(value)
	case sectionData:
		// Complex multi-table transaction for data section
		return w.closeData(value)
	default:
		return fmt.Errorf("unsupported section: %s", w.section)
	}
}

// closeEvents handles the simple upsert for the events section
func (w *sqlWriteCloser) closeEvents(value []byte) error {
	tableName, err := w.kv.getTableName(w.section)
	if err != nil {
		return err
	}

	keyPathIdent, err := w.kv.ident("key_path")
	if err != nil {
		return fmt.Errorf("invalid column identifier: %w", err)
	}

	valueIdent, err := w.kv.ident("value")
	if err != nil {
		return fmt.Errorf("invalid column identifier: %w", err)
	}

	ph1 := w.kv.dialect.ArgPlaceholder(1)
	ph2 := w.kv.dialect.ArgPlaceholder(2)

	var query string
	switch w.kv.dialect.DialectName() {
	case "postgres":
		query = fmt.Sprintf(
			"INSERT INTO %s (%s, %s) VALUES (%s, %s) ON CONFLICT (%s) DO UPDATE SET %s = EXCLUDED.%s",
			tableName, keyPathIdent, valueIdent, ph1, ph2, keyPathIdent, valueIdent, valueIdent,
		)
	case "mysql":
		query = fmt.Sprintf(
			"INSERT INTO %s (%s, %s) VALUES (%s, %s) ON DUPLICATE KEY UPDATE %s = VALUES(%s)",
			tableName, keyPathIdent, valueIdent, ph1, ph2, valueIdent, valueIdent,
		)
	case "sqlite":
		query = fmt.Sprintf(
			"INSERT INTO %s (%s, %s) VALUES (%s, %s) ON CONFLICT (%s) DO UPDATE SET %s = excluded.%s",
			tableName, keyPathIdent, valueIdent, ph1, ph2, keyPathIdent, valueIdent, valueIdent,
		)
	default:
		return fmt.Errorf("unsupported dialect: %s", w.kv.dialect.DialectName())
	}

	_, err = w.kv.db.ExecContext(w.ctx, query, w.key, value)
	if err != nil {
		return fmt.Errorf("insert/update failed: %w", err)
	}

	return nil
}

// closeData handles the complex multi-table transaction for the data section
func (w *sqlWriteCloser) closeData(value []byte) error {
	// Parse the key to extract all fields
	parsed, err := parseDataKey(w.key)
	if err != nil {
		return fmt.Errorf("parse key: %w", err)
	}

	// Generate a GUID for this write
	guid := uuid.New().String()

	// Execute all operations in a transaction
	return w.kv.db.WithTx(w.ctx, nil, func(ctx context.Context, tx db.Tx) error {
		// 1. Insert/update resource_history
		if err := w.upsertResourceHistory(ctx, tx, parsed, guid, value); err != nil {
			return fmt.Errorf("upsert resource_history: %w", err)
		}

		// 2. Handle resource table based on action
		if parsed.Action == 3 { // deleted
			if err := w.deleteResource(ctx, tx, parsed); err != nil {
				return fmt.Errorf("delete resource: %w", err)
			}
		} else { // created or updated
			if err := w.upsertResource(ctx, tx, parsed, guid, value); err != nil {
				return fmt.Errorf("upsert resource: %w", err)
			}
		}

		// 3. Upsert resource_version table
		if err := w.upsertResourceVersion(ctx, tx, parsed); err != nil {
			return fmt.Errorf("upsert resource_version: %w", err)
		}

		return nil
	})
}

// upsertResourceHistory inserts/updates a row in the resource_history table
func (w *sqlWriteCloser) upsertResourceHistory(ctx context.Context, tx db.Tx, parsed *parsedKey, guid string, value []byte) error {
	// Build identifiers
	tableIdent, _ := w.kv.ident("resource_history")
	guidIdent, _ := w.kv.ident("guid")
	groupIdent, _ := w.kv.ident("group")
	resourceIdent, _ := w.kv.ident("resource")
	namespaceIdent, _ := w.kv.ident("namespace")
	nameIdent, _ := w.kv.ident("name")
	rvIdent, _ := w.kv.ident("resource_version")
	prevRVIdent, _ := w.kv.ident("previous_resource_version")
	valueIdent, _ := w.kv.ident("value")
	actionIdent, _ := w.kv.ident("action")
	folderIdent, _ := w.kv.ident("folder")
	keyPathIdent, _ := w.kv.ident("key_path")

	// Build placeholders
	var query string
	ph := func(n int) string { return w.kv.dialect.ArgPlaceholder(n) }

	switch w.kv.dialect.DialectName() {
	case "postgres":
		query = fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
			VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s)
			ON CONFLICT (%s) DO UPDATE SET %s = EXCLUDED.%s, %s = EXCLUDED.%s`,
			tableIdent, guidIdent, keyPathIdent, groupIdent, resourceIdent, namespaceIdent, nameIdent,
			rvIdent, prevRVIdent, valueIdent, actionIdent, folderIdent,
			ph(1), ph(2), ph(3), ph(4), ph(5), ph(6), ph(7), ph(8), ph(9), ph(10),
			guidIdent, valueIdent, valueIdent, keyPathIdent, keyPathIdent,
		)
	case "mysql", "sqlite":
		// For MySQL and SQLite, use INSERT OR REPLACE (requires all columns)
		query = fmt.Sprintf(`
			REPLACE INTO %s (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
			VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s)`,
			tableIdent, guidIdent, keyPathIdent, groupIdent, resourceIdent, namespaceIdent, nameIdent,
			rvIdent, prevRVIdent, valueIdent, actionIdent, folderIdent,
			ph(1), ph(2), ph(3), ph(4), ph(5), ph(6), ph(7), ph(8), ph(9), ph(10),
		)
	default:
		return fmt.Errorf("unsupported dialect: %s", w.kv.dialect.DialectName())
	}

	_, err := tx.ExecContext(ctx, query,
		guid, w.key, parsed.Group, parsed.Resource, parsed.Namespace, parsed.Name,
		parsed.ResourceVersion, value, parsed.Action, parsed.Folder,
	)
	return err
}

// upsertResource inserts/updates a row in the resource table
func (w *sqlWriteCloser) upsertResource(ctx context.Context, tx db.Tx, parsed *parsedKey, guid string, value []byte) error {
	// Build identifiers
	tableIdent, _ := w.kv.ident("resource")
	guidIdent, _ := w.kv.ident("guid")
	groupIdent, _ := w.kv.ident("group")
	resourceIdent, _ := w.kv.ident("resource")
	namespaceIdent, _ := w.kv.ident("namespace")
	nameIdent, _ := w.kv.ident("name")
	rvIdent, _ := w.kv.ident("resource_version")
	valueIdent, _ := w.kv.ident("value")
	actionIdent, _ := w.kv.ident("action")

	var query string
	ph := func(n int) string { return w.kv.dialect.ArgPlaceholder(n) }

	switch w.kv.dialect.DialectName() {
	case "postgres":
		query = fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			ON CONFLICT (%s, %s, %s, %s) DO UPDATE SET 
				%s = EXCLUDED.%s, %s = EXCLUDED.%s, %s = EXCLUDED.%s, %s = EXCLUDED.%s`,
			tableIdent, guidIdent, groupIdent, resourceIdent, namespaceIdent, nameIdent, rvIdent, valueIdent, actionIdent,
			ph(1), ph(2), ph(3), ph(4), ph(5), ph(6), ph(7), ph(8),
			namespaceIdent, groupIdent, resourceIdent, nameIdent,
			guidIdent, guidIdent, rvIdent, rvIdent, valueIdent, valueIdent, actionIdent, actionIdent,
		)
	case "mysql", "sqlite":
		query = fmt.Sprintf(`
			REPLACE INTO %s (%s, %s, %s, %s, %s, %s, %s, %s)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)`,
			tableIdent, guidIdent, groupIdent, resourceIdent, namespaceIdent, nameIdent, rvIdent, valueIdent, actionIdent,
			ph(1), ph(2), ph(3), ph(4), ph(5), ph(6), ph(7), ph(8),
		)
	default:
		return fmt.Errorf("unsupported dialect: %s", w.kv.dialect.DialectName())
	}

	_, err := tx.ExecContext(ctx, query,
		guid, parsed.Group, parsed.Resource, parsed.Namespace, parsed.Name,
		parsed.ResourceVersion, value, parsed.Action,
	)
	return err
}

// deleteResource deletes a row from the resource table
func (w *sqlWriteCloser) deleteResource(ctx context.Context, tx db.Tx, parsed *parsedKey) error {
	tableIdent, _ := w.kv.ident("resource")
	groupIdent, _ := w.kv.ident("group")
	resourceIdent, _ := w.kv.ident("resource")
	namespaceIdent, _ := w.kv.ident("namespace")
	nameIdent, _ := w.kv.ident("name")

	ph := func(n int) string { return w.kv.dialect.ArgPlaceholder(n) }

	query := fmt.Sprintf(`
		DELETE FROM %s WHERE %s = %s AND %s = %s AND %s = %s AND %s = %s`,
		tableIdent, groupIdent, ph(1), resourceIdent, ph(2), namespaceIdent, ph(3), nameIdent, ph(4),
	)

	_, err := tx.ExecContext(ctx, query, parsed.Group, parsed.Resource, parsed.Namespace, parsed.Name)
	return err
}

// upsertResourceVersion inserts/updates the resource_version table
func (w *sqlWriteCloser) upsertResourceVersion(ctx context.Context, tx db.Tx, parsed *parsedKey) error {
	tableIdent, _ := w.kv.ident("resource_version")
	groupIdent, _ := w.kv.ident("group")
	resourceIdent, _ := w.kv.ident("resource")
	rvIdent, _ := w.kv.ident("resource_version")

	ph := func(n int) string { return w.kv.dialect.ArgPlaceholder(n) }

	var query string
	switch w.kv.dialect.DialectName() {
	case "postgres":
		query = fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s) VALUES (%s, %s, %s)
			ON CONFLICT (%s, %s) DO UPDATE SET %s = EXCLUDED.%s`,
			tableIdent, groupIdent, resourceIdent, rvIdent, ph(1), ph(2), ph(3),
			groupIdent, resourceIdent, rvIdent, rvIdent,
		)
	case "mysql", "sqlite":
		query = fmt.Sprintf(`
			REPLACE INTO %s (%s, %s, %s) VALUES (%s, %s, %s)`,
			tableIdent, groupIdent, resourceIdent, rvIdent, ph(1), ph(2), ph(3),
		)
	default:
		return fmt.Errorf("unsupported dialect: %s", w.kv.dialect.DialectName())
	}

	_, err := tx.ExecContext(ctx, query, parsed.Group, parsed.Resource, parsed.ResourceVersion)
	return err
}

// Delete a value
func (k *sqlKV) Delete(ctx context.Context, section string, key string) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}
	if key == "" {
		return fmt.Errorf("key is required")
	}

	tableName, err := k.getTableName(section)
	if err != nil {
		return err
	}

	keyPathIdent, err := k.ident("key_path")
	if err != nil {
		return fmt.Errorf("invalid column identifier: %w", err)
	}

	// First check if key exists (to return ErrNotFound if missing)
	checkQuery := fmt.Sprintf(
		"SELECT 1 FROM %s WHERE %s = %s",
		tableName,
		keyPathIdent,
		k.dialect.ArgPlaceholder(1),
	)

	var exists int
	err = k.db.QueryRowContext(ctx, checkQuery, key).Scan(&exists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("check existence failed: %w", err)
	}

	// Delete the key
	deleteQuery := fmt.Sprintf(
		"DELETE FROM %s WHERE %s = %s",
		tableName,
		keyPathIdent,
		k.dialect.ArgPlaceholder(1),
	)

	_, err = k.db.ExecContext(ctx, deleteQuery, key)
	if err != nil {
		return fmt.Errorf("delete failed: %w", err)
	}

	return nil
}

// BatchDelete removes multiple keys from the store
func (k *sqlKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}

	if len(keys) == 0 {
		return nil // Nothing to delete
	}

	tableName, err := k.getTableName(section)
	if err != nil {
		return err
	}

	keyPathIdent, err := k.ident("key_path")
	if err != nil {
		return fmt.Errorf("invalid column identifier: %w", err)
	}

	// Build IN clause placeholders
	placeholders := make([]string, len(keys))
	args := make([]interface{}, len(keys))
	for i, key := range keys {
		placeholders[i] = k.dialect.ArgPlaceholder(i + 1)
		args[i] = key
	}

	// Build the query
	query := fmt.Sprintf(
		"DELETE FROM %s WHERE %s IN (%s)",
		tableName,
		keyPathIdent,
		strings.Join(placeholders, ", "),
	)

	// Execute the query (idempotent - non-existent keys are silently ignored)
	_, err = k.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("batch delete failed: %w", err)
	}

	return nil
}

// UnixTimestamp returns the current time in seconds since Epoch
func (k *sqlKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return time.Now().Unix(), nil
}
