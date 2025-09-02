//go:build !cgo

package sqlite

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"runtime"
	"strings"
	"sync"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

type Driver = sqlite.Driver

const DriverName = "sqlite"

// The errors below are used in tests to simulate specific SQLite errors. It's a temporary solution
// until we rewrite the tests not to depend on the sqlite3 package internals directly.
// Note: Since modernc.org/sqlite driver does not expose error codes like sqlite3, we cannot use the same approach.
var (
	TestErrUniqueConstraintViolation = errors.New("unique constraint violation (simulated)")
	TestErrBusy                      = errors.New("database is busy (simulated)")
	TestErrLocked                    = errors.New("database is locked (simulated)")
)

// TransactionTracer wraps a SQL driver to trace all transaction operations
type TransactionTracer struct {
	driver.Driver
	connID int
	name   string
	logger *log.Logger
}

type tracedConn struct {
	driver.Conn
	tracer *TransactionTracer
	connID string
}

type tracedTx struct {
	driver.Tx
	tracer *TransactionTracer
	connID string
	txID   string
}

// tracedStmt wraps statements to intercept SQL execution
type tracedStmt struct {
	driver.Stmt
	tracer *TransactionTracer
	connID string
	query  string
}

var (
	txCounter int64
	txMutex   sync.Mutex
	logFile   *os.File
)

var dsnAlias = map[string]string{
	"_vacuum":   "_auto_vacuum",
	"_timeout":  "_busy_timeout",
	"_cslike":   "_case_sensitive_like",
	"_defer_fk": "_defer_foreign_keys",
	"_fk":       "_foreign_keys",
	"_journal":  "_journal_mode",
	"_locking":  "_locking_mode",
	"_rt":       "_recursive_triggers",
	"_sync":     "_synchronous",
}

var dsnMapping = map[string]string{
	"cache":                "", // unsupported
	"mode":                 "", // unsupported
	"_journal_mode":        "_pragma",
	"_synchronous":         "_pragma",
	"_locking_mode":        "_pragma",
	"_busy_timeout":        "_pragma",
	"_foreign_keys":        "_pragma",
	"_auto_vacuum":         "_pragma",
	"_cache_size":          "_pragma",
	"_case_sensitive_like": "_pragma",
	"_defer_foreign_keys":  "_pragma",
	"_temp_store":          "_pragma",
	"_secure_delete":       "_pragma",
	"_txlock":              "_txlock",
	"_time_format":         "_time_format",
}

func convertSQLite3URL(dsn string) (string, error) {
	pos := strings.IndexRune(dsn, '?')
	if pos < 1 {
		return dsn, nil // no parameters to convert
	}
	params, err := url.ParseQuery(dsn[pos+1:])
	if err != nil {
		return "", err
	}
	newDSN := dsn[:pos]

	q := url.Values{}
	q.Add("_pragma", "busy_timeout(5000)")

	for key, values := range params {
		if alias, ok := dsnAlias[strings.ToLower(key)]; ok {
			key = alias
		}
		mapped, ok := dsnMapping[key]
		if !ok || len(values) == 0 {
			continue
		}
		value := values[0]
		switch mapped {
		case "_pragma":
			value = strings.TrimPrefix(value, "_")
			q.Add("_pragma", fmt.Sprintf("%s(%s)", key, value))
		case "_txlock":
			q.Set("_txlock", value)
		case "_time_format":
			q.Set("_time_format", value)
		}
	}
	if len(q) > 0 {
		newDSN += "?" + q.Encode()
	}
	return newDSN, nil
}

// NewTransactionTracer creates a new transaction tracer wrapper
func NewTransactionTracer(name string, underlying driver.Driver) *TransactionTracer {
	logger := log.New(os.Stdout, fmt.Sprintf("[TX-TRACE-%s] ", name), log.LstdFlags|log.Lmicroseconds)
	if logFile != nil {
		logger = log.New(logFile, fmt.Sprintf("[TX-TRACE-%s] ", name), log.LstdFlags|log.Lmicroseconds)
	}

	return &TransactionTracer{
		Driver: underlying,
		name:   name,
		logger: logger,
	}
}

func (t *TransactionTracer) Open(name string) (driver.Conn, error) {
	url, err := convertSQLite3URL(name)
	if err != nil {
		return nil, err
	}
	conn, err := t.Driver.Open(url)
	if err != nil {
		return nil, err
	}

	connID := fmt.Sprintf("conn-%d", t.connID)
	t.connID++
	t.logger.Printf("CONN_OPEN %s [g%d] %s %s", connID, getGoroutineID(), name, url)

	return &tracedConn{
		Conn:   conn,
		tracer: t,
		connID: connID,
	}, nil
}

func (c *tracedConn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *tracedConn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	txMutex.Lock()
	txCounter++
	txID := fmt.Sprintf("tx-%d", txCounter)
	txMutex.Unlock()

	// Get compact caller info
	caller := getCompactCaller()
	goroutineID := getGoroutineID()

	var tx driver.Tx
	var err error

	if connTx, ok := c.Conn.(driver.ConnBeginTx); ok {
		tx, err = connTx.BeginTx(ctx, opts)
	} else {
		tx, err = c.Conn.Begin()
	}

	if err != nil {
		c.tracer.logger.Printf("BEGIN_FAILED %s %s [g%d] %s: %v", c.connID, txID, goroutineID, caller, err)
		return nil, err
	}

	c.tracer.logger.Printf("BEGIN %s %s [g%d] %s", c.connID, txID, goroutineID, caller)

	return &tracedTx{
		Tx:     tx,
		tracer: c.tracer,
		connID: c.connID,
		txID:   txID,
	}, nil
}

func (t *tracedTx) Commit() error {
	caller := getCompactCaller()
	goroutineID := getGoroutineID()
	err := t.Tx.Commit()
	if err != nil {
		t.tracer.logger.Printf("COMMIT_FAILED %s %s [g%d] %s: %v", t.connID, t.txID, goroutineID, caller, err)
	} else {
		t.tracer.logger.Printf("COMMIT %s %s [g%d] %s", t.connID, t.txID, goroutineID, caller)
	}
	return err
}

func (t *tracedTx) Rollback() error {
	caller := getCompactCaller()
	goroutineID := getGoroutineID()
	err := t.Tx.Rollback()
	if err != nil {
		t.tracer.logger.Printf("ROLLBACK_FAILED %s %s [g%d] %s: %v", t.connID, t.txID, goroutineID, caller, err)
	} else {
		t.tracer.logger.Printf("ROLLBACK %s %s [g%d] %s", t.connID, t.txID, goroutineID, caller)
	}
	return err
}

func getCompactCaller() string {
	pc, file, line, ok := runtime.Caller(3)
	if !ok {
		return "unknown"
	}

	fn := runtime.FuncForPC(pc)
	name := "unknown"
	if fn != nil {
		name = fn.Name()
		// Shorten function name - just keep the last part after the last dot
		if idx := strings.LastIndex(name, "."); idx >= 0 {
			name = name[idx+1:]
		}
	}

	// Shorten file path - just keep the filename
	if idx := strings.LastIndex(file, "/"); idx >= 0 {
		file = file[idx+1:]
	}

	return fmt.Sprintf("%s:%d(%s)", file, line, name)
}

// getGoroutineID extracts the goroutine ID from the stack trace
func getGoroutineID() int {
	buf := make([]byte, 64)
	buf = buf[:runtime.Stack(buf, false)]
	// Extract goroutine ID from "goroutine 123 [running]:"
	if idx := strings.Index(string(buf), "goroutine "); idx >= 0 {
		start := idx + 10
		if end := strings.Index(string(buf[start:]), " "); end >= 0 {
			if idStr := string(buf[start : start+end]); idStr != "" {
				var goroutineID int
				if _, err := fmt.Sscanf(idStr, "%d", &goroutineID); err == nil {
					return goroutineID
				}
			}
		}
	}
	return -1
}

// Intercept Prepare to capture SQL statements
func (c *tracedConn) Prepare(query string) (driver.Stmt, error) {
	stmt, err := c.Conn.Prepare(query)
	if err != nil {
		return nil, err
	}
	return &tracedStmt{
		Stmt:   stmt,
		tracer: c.tracer,
		connID: c.connID,
		query:  query,
	}, nil
}

// Intercept Exec to capture direct SQL execution
func (c *tracedConn) Exec(query string, args []driver.Value) (driver.Result, error) {
	goroutineID := getGoroutineID()
	queryUpper := strings.ToUpper(strings.TrimSpace(query))

	if strings.HasPrefix(queryUpper, "BEGIN") {
		c.tracer.logger.Printf("SQL_BEGIN %s [g%d]: %s", c.connID, goroutineID, query)
	} else if strings.HasPrefix(queryUpper, "COMMIT") {
		c.tracer.logger.Printf("SQL_COMMIT %s [g%d]: %s", c.connID, goroutineID, query)
	} else if strings.HasPrefix(queryUpper, "ROLLBACK") {
		c.tracer.logger.Printf("SQL_ROLLBACK %s [g%d]: %s", c.connID, goroutineID, query)
	}

	if execer, ok := c.Conn.(driver.Execer); ok {
		return execer.Exec(query, args)
	}
	return nil, driver.ErrSkip
}

// Intercept statement execution
func (s *tracedStmt) Exec(args []driver.Value) (driver.Result, error) {
	goroutineID := getGoroutineID()
	queryUpper := strings.ToUpper(strings.TrimSpace(s.query))

	if strings.HasPrefix(queryUpper, "BEGIN") {
		s.tracer.logger.Printf("STMT_BEGIN %s [g%d]: %s", s.connID, goroutineID, s.query)
	} else if strings.HasPrefix(queryUpper, "COMMIT") {
		s.tracer.logger.Printf("STMT_COMMIT %s [g%d]: %s", s.connID, goroutineID, s.query)
	} else if strings.HasPrefix(queryUpper, "ROLLBACK") {
		s.tracer.logger.Printf("STMT_ROLLBACK %s [g%d]: %s", s.connID, goroutineID, s.query)
	}

	return s.Stmt.Exec(args)
}

func init() {
	// Open a log file for transaction tracing
	var err error
	logFile, err = os.OpenFile("/tmp/grafana_tx_trace.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("Failed to open transaction trace log: %v\n", err)
		logFile = nil
	}

	// Register a transaction-traced version of the SQLite driver instead of the bare driver
	// This will help us debug nested transaction issues
	sql.Register("sqlite3", NewTransactionTracer("SQLite", &Driver{}))
}

func IsBusyOrLocked(err error) bool {
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		// Code is 32-bit number, low 8 bits are the SQLite error code, high 24 bits are extended code.
		code := sqliteErr.Code() & 0xff
		return code == sqlite3.SQLITE_BUSY || code == sqlite3.SQLITE_LOCKED
	}
	if errors.Is(err, TestErrBusy) || errors.Is(err, TestErrLocked) {
		return true
	}
	return false
}

func IsUniqueConstraintViolation(err error) bool {
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		// These constants are extended codes combined with primary code, so we can check them directly.
		return sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_PRIMARYKEY || sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE
	}
	if errors.Is(err, TestErrUniqueConstraintViolation) {
		return true
	}
	return false
}

func ErrorMessage(err error) string {
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Error()
	}
	return ""
}
