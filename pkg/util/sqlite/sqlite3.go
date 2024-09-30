// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"net/url"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/mattn/go-sqlite3/cc"
	"modernc.org/libc/sys/types"
	"modernc.org/libc"
)

// ErrNo inherit errno.
type ErrNo int

// ErrNoMask is mask code.
const ErrNoMask = 0xff

// ErrNoExtended is extended errno.
type ErrNoExtended int

// Error implement sqlite error code.
type Error struct {
	Code         ErrNo         /* The error code returned by SQLite */
	ExtendedCode ErrNoExtended /* The extended error code returned by SQLite */
	SystemErrno  syscall.Errno /* The system errno returned by the OS through SQLite, if applicable */
	err          string        /* The error string returned by sqlite3_errmsg(),
	this usually contains more specific details. */
}

// result codes from http://www.sqlite.org/c3ref/c_abort.html
var (
	ErrError      = ErrNo(1)  /* SQL error or missing database */
	ErrInternal   = ErrNo(2)  /* Internal logic error in SQLite */
	ErrPerm       = ErrNo(3)  /* Access permission denied */
	ErrAbort      = ErrNo(4)  /* Callback routine requested an abort */
	ErrBusy       = ErrNo(5)  /* The database file is locked */
	ErrLocked     = ErrNo(6)  /* A table in the database is locked */
	ErrNomem      = ErrNo(7)  /* A malloc() failed */
	ErrReadonly   = ErrNo(8)  /* Attempt to write a readonly database */
	ErrInterrupt  = ErrNo(9)  /* Operation terminated by sqlite3_interrupt() */
	ErrIoErr      = ErrNo(10) /* Some kind of disk I/O error occurred */
	ErrCorrupt    = ErrNo(11) /* The database disk image is malformed */
	ErrNotFound   = ErrNo(12) /* Unknown opcode in sqlite3_file_control() */
	ErrFull       = ErrNo(13) /* Insertion failed because database is full */
	ErrCantOpen   = ErrNo(14) /* Unable to open the database file */
	ErrProtocol   = ErrNo(15) /* Database lock protocol error */
	ErrEmpty      = ErrNo(16) /* Database is empty */
	ErrSchema     = ErrNo(17) /* The database schema changed */
	ErrTooBig     = ErrNo(18) /* String or BLOB exceeds size limit */
	ErrConstraint = ErrNo(19) /* Abort due to constraint violation */
	ErrMismatch   = ErrNo(20) /* Data type mismatch */
	ErrMisuse     = ErrNo(21) /* Library used incorrectly */
	ErrNoLFS      = ErrNo(22) /* Uses OS features not supported on host */
	ErrAuth       = ErrNo(23) /* Authorization denied */
	ErrFormat     = ErrNo(24) /* Auxiliary database format error */
	ErrRange      = ErrNo(25) /* 2nd parameter to sqlite3_bind out of range */
	ErrNotADB     = ErrNo(26) /* File opened that is not a database file */
	ErrNotice     = ErrNo(27) /* Notifications from sqlite3_log() */
	ErrWarning    = ErrNo(28) /* Warnings from sqlite3_log() */
)

// Error return error message from errno.
func (err ErrNo) Error() string {
	return Error{Code: err}.Error()
}

// Extend return extended errno.
func (err ErrNo) Extend(by int) ErrNoExtended {
	return ErrNoExtended(int(err) | (by << 8))
}

// Error return error message that is extended code.
func (err ErrNoExtended) Error() string {
	return Error{Code: ErrNo(int(err) & ErrNoMask), ExtendedCode: err}.Error()
}

func (err Error) Error() string {
	var str string
	if err.err != "" {
		str = err.err
	} else {
		str = libc.GoString(cc.Xsqlite3_errstr(nil, int32(err.Code)))
	}
	if err.SystemErrno != 0 {
		str += ": " + err.SystemErrno.Error()
	}
	return str
}

// result codes from http://www.sqlite.org/c3ref/c_abort_rollback.html
var (
	ErrIoErrRead              = ErrIoErr.Extend(1)
	ErrIoErrShortRead         = ErrIoErr.Extend(2)
	ErrIoErrWrite             = ErrIoErr.Extend(3)
	ErrIoErrFsync             = ErrIoErr.Extend(4)
	ErrIoErrDirFsync          = ErrIoErr.Extend(5)
	ErrIoErrTruncate          = ErrIoErr.Extend(6)
	ErrIoErrFstat             = ErrIoErr.Extend(7)
	ErrIoErrUnlock            = ErrIoErr.Extend(8)
	ErrIoErrRDlock            = ErrIoErr.Extend(9)
	ErrIoErrDelete            = ErrIoErr.Extend(10)
	ErrIoErrBlocked           = ErrIoErr.Extend(11)
	ErrIoErrNoMem             = ErrIoErr.Extend(12)
	ErrIoErrAccess            = ErrIoErr.Extend(13)
	ErrIoErrCheckReservedLock = ErrIoErr.Extend(14)
	ErrIoErrLock              = ErrIoErr.Extend(15)
	ErrIoErrClose             = ErrIoErr.Extend(16)
	ErrIoErrDirClose          = ErrIoErr.Extend(17)
	ErrIoErrSHMOpen           = ErrIoErr.Extend(18)
	ErrIoErrSHMSize           = ErrIoErr.Extend(19)
	ErrIoErrSHMLock           = ErrIoErr.Extend(20)
	ErrIoErrSHMMap            = ErrIoErr.Extend(21)
	ErrIoErrSeek              = ErrIoErr.Extend(22)
	ErrIoErrDeleteNoent       = ErrIoErr.Extend(23)
	ErrIoErrMMap              = ErrIoErr.Extend(24)
	ErrIoErrGetTempPath       = ErrIoErr.Extend(25)
	ErrIoErrConvPath          = ErrIoErr.Extend(26)
	ErrLockedSharedCache      = ErrLocked.Extend(1)
	ErrBusyRecovery           = ErrBusy.Extend(1)
	ErrBusySnapshot           = ErrBusy.Extend(2)
	ErrCantOpenNoTempDir      = ErrCantOpen.Extend(1)
	ErrCantOpenIsDir          = ErrCantOpen.Extend(2)
	ErrCantOpenFullPath       = ErrCantOpen.Extend(3)
	ErrCantOpenConvPath       = ErrCantOpen.Extend(4)
	ErrCorruptVTab            = ErrCorrupt.Extend(1)
	ErrReadonlyRecovery       = ErrReadonly.Extend(1)
	ErrReadonlyCantLock       = ErrReadonly.Extend(2)
	ErrReadonlyRollback       = ErrReadonly.Extend(3)
	ErrReadonlyDbMoved        = ErrReadonly.Extend(4)
	ErrAbortRollback          = ErrAbort.Extend(2)
	ErrConstraintCheck        = ErrConstraint.Extend(1)
	ErrConstraintCommitHook   = ErrConstraint.Extend(2)
	ErrConstraintForeignKey   = ErrConstraint.Extend(3)
	ErrConstraintFunction     = ErrConstraint.Extend(4)
	ErrConstraintNotNull      = ErrConstraint.Extend(5)
	ErrConstraintPrimaryKey   = ErrConstraint.Extend(6)
	ErrConstraintTrigger      = ErrConstraint.Extend(7)
	ErrConstraintUnique       = ErrConstraint.Extend(8)
	ErrConstraintVTab         = ErrConstraint.Extend(9)
	ErrConstraintRowID        = ErrConstraint.Extend(10)
	ErrNoticeRecoverWAL       = ErrNotice.Extend(1)
	ErrNoticeRecoverRollback  = ErrNotice.Extend(2)
	ErrWarningAutoIndex       = ErrWarning.Extend(1)
)

// SQLiteTimestampFormats is timestamp formats understood by both this module
// and SQLite.  The first format in the slice will be used when saving time
// values into the database. When parsing a string from a timestamp or datetime
// column, the formats are tried in order.
var SQLiteTimestampFormats = []string{
	// By default, store timestamps with whatever timezone they come with.
	// When parsed, they will be returned with the same timezone.
	"2006-01-02 15:04:05.999999999-07:00",
	"2006-01-02T15:04:05.999999999-07:00",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04:05",
	"2006-01-02T15:04:05",
	"2006-01-02 15:04",
	"2006-01-02T15:04",
	"2006-01-02",
}

const (
	columnDate      string = "date"
	columnDatetime  string = "datetime"
	columnTimestamp string = "timestamp"
)

// This variable can be replaced with -ldflags like below:
// go build -ldflags="-X 'github.com/mattn/go-sqlite3.driverName=my-sqlite3'"
var driverName = "sqlite3"

func init() {
	fmt.Println("\n>>> LOCAL FRANKENSTEIN SQLITE STARTED\n")
	if driverName != "" {
		sql.Register(driverName, &SQLiteDriver{tls: libc.NewTLS()})
	}
}

const (
	// used by authorizer and pre_update_hook
	SQLITE_DELETE = cc.SQLITE_DELETE
	SQLITE_INSERT = cc.SQLITE_INSERT
	SQLITE_UPDATE = cc.SQLITE_UPDATE

	// used by authorzier - as return value
	SQLITE_OK     = cc.SQLITE_OK
	SQLITE_IGNORE = cc.SQLITE_IGNORE
	SQLITE_DENY   = cc.SQLITE_DENY

	// different actions query tries to do - passed as argument to authorizer
	SQLITE_CREATE_INDEX        = cc.SQLITE_CREATE_INDEX
	SQLITE_CREATE_TABLE        = cc.SQLITE_CREATE_TABLE
	SQLITE_CREATE_TEMP_INDEX   = cc.SQLITE_CREATE_TEMP_INDEX
	SQLITE_CREATE_TEMP_TABLE   = cc.SQLITE_CREATE_TEMP_TABLE
	SQLITE_CREATE_TEMP_TRIGGER = cc.SQLITE_CREATE_TEMP_TRIGGER
	SQLITE_CREATE_TEMP_VIEW    = cc.SQLITE_CREATE_TEMP_VIEW
	SQLITE_CREATE_TRIGGER      = cc.SQLITE_CREATE_TRIGGER
	SQLITE_CREATE_VIEW         = cc.SQLITE_CREATE_VIEW
	SQLITE_CREATE_VTABLE       = cc.SQLITE_CREATE_VTABLE
	SQLITE_DROP_INDEX          = cc.SQLITE_DROP_INDEX
	SQLITE_DROP_TABLE          = cc.SQLITE_DROP_TABLE
	SQLITE_DROP_TEMP_INDEX     = cc.SQLITE_DROP_TEMP_INDEX
	SQLITE_DROP_TEMP_TABLE     = cc.SQLITE_DROP_TEMP_TABLE
	SQLITE_DROP_TEMP_TRIGGER   = cc.SQLITE_DROP_TEMP_TRIGGER
	SQLITE_DROP_TEMP_VIEW      = cc.SQLITE_DROP_TEMP_VIEW
	SQLITE_DROP_TRIGGER        = cc.SQLITE_DROP_TRIGGER
	SQLITE_DROP_VIEW           = cc.SQLITE_DROP_VIEW
	SQLITE_DROP_VTABLE         = cc.SQLITE_DROP_VTABLE
	SQLITE_PRAGMA              = cc.SQLITE_PRAGMA
	SQLITE_READ                = cc.SQLITE_READ
	SQLITE_SELECT              = cc.SQLITE_SELECT
	SQLITE_TRANSACTION         = cc.SQLITE_TRANSACTION
	SQLITE_ATTACH              = cc.SQLITE_ATTACH
	SQLITE_DETACH              = cc.SQLITE_DETACH
	SQLITE_ALTER_TABLE         = cc.SQLITE_ALTER_TABLE
	SQLITE_REINDEX             = cc.SQLITE_REINDEX
	SQLITE_ANALYZE             = cc.SQLITE_ANALYZE
	SQLITE_FUNCTION            = cc.SQLITE_FUNCTION
	SQLITE_SAVEPOINT           = cc.SQLITE_SAVEPOINT
	SQLITE_COPY                = cc.SQLITE_COPY
	/*SQLITE_RECURSIVE           = cc.SQLITE_RECURSIVE*/

	SQLITE_STATIC    = uintptr(0)  // ((sqlite3_destructor_type)0)
	SQLITE_TRANSIENT = ^uintptr(0) // ((sqlite3_destructor_type)-1)
)

// Standard File Control Opcodes
// See: https://www.sqlite.org/c3ref/c_fcntl_begin_atomic_write.html
const (
	SQLITE_FCNTL_LOCKSTATE             = int(1)
	SQLITE_FCNTL_GET_LOCKPROXYFILE     = int(2)
	SQLITE_FCNTL_SET_LOCKPROXYFILE     = int(3)
	SQLITE_FCNTL_LAST_ERRNO            = int(4)
	SQLITE_FCNTL_SIZE_HINT             = int(5)
	SQLITE_FCNTL_CHUNK_SIZE            = int(6)
	SQLITE_FCNTL_FILE_POINTER          = int(7)
	SQLITE_FCNTL_SYNC_OMITTED          = int(8)
	SQLITE_FCNTL_WIN32_AV_RETRY        = int(9)
	SQLITE_FCNTL_PERSIST_WAL           = int(10)
	SQLITE_FCNTL_OVERWRITE             = int(11)
	SQLITE_FCNTL_VFSNAME               = int(12)
	SQLITE_FCNTL_POWERSAFE_OVERWRITE   = int(13)
	SQLITE_FCNTL_PRAGMA                = int(14)
	SQLITE_FCNTL_BUSYHANDLER           = int(15)
	SQLITE_FCNTL_TEMPFILENAME          = int(16)
	SQLITE_FCNTL_MMAP_SIZE             = int(18)
	SQLITE_FCNTL_TRACE                 = int(19)
	SQLITE_FCNTL_HAS_MOVED             = int(20)
	SQLITE_FCNTL_SYNC                  = int(21)
	SQLITE_FCNTL_COMMIT_PHASETWO       = int(22)
	SQLITE_FCNTL_WIN32_SET_HANDLE      = int(23)
	SQLITE_FCNTL_WAL_BLOCK             = int(24)
	SQLITE_FCNTL_ZIPVFS                = int(25)
	SQLITE_FCNTL_RBU                   = int(26)
	SQLITE_FCNTL_VFS_POINTER           = int(27)
	SQLITE_FCNTL_JOURNAL_POINTER       = int(28)
	SQLITE_FCNTL_WIN32_GET_HANDLE      = int(29)
	SQLITE_FCNTL_PDB                   = int(30)
	SQLITE_FCNTL_BEGIN_ATOMIC_WRITE    = int(31)
	SQLITE_FCNTL_COMMIT_ATOMIC_WRITE   = int(32)
	SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE = int(33)
	SQLITE_FCNTL_LOCK_TIMEOUT          = int(34)
	SQLITE_FCNTL_DATA_VERSION          = int(35)
	SQLITE_FCNTL_SIZE_LIMIT            = int(36)
	SQLITE_FCNTL_CKPT_DONE             = int(37)
	SQLITE_FCNTL_RESERVE_BYTES         = int(38)
	SQLITE_FCNTL_CKPT_START            = int(39)
	SQLITE_FCNTL_EXTERNAL_READER       = int(40)
	SQLITE_FCNTL_CKSM_FILE             = int(41)
)

// SQLiteDriver implements driver.Driver.
type SQLiteDriver struct {
	tls *libc.TLS
}

// SQLiteConn implements driver.Conn.
type SQLiteConn struct {
	mu     sync.Mutex
	tls    *libc.TLS
	db     uintptr
	loc    *time.Location
	txlock string
}

// SQLiteTx implements driver.Tx.
type SQLiteTx struct {
	c *SQLiteConn
}

// SQLiteStmt implements driver.Stmt.
type SQLiteStmt struct {
	mu     sync.Mutex
	c      *SQLiteConn
	s      uintptr
	t      string
	closed bool
	cls    bool
}

// SQLiteResult implements sql.Result.
type SQLiteResult struct {
	id      int64
	changes int64
}

// SQLiteRows implements driver.Rows.
type SQLiteRows struct {
	s        *SQLiteStmt
	nc       int
	cols     []string
	decltype []string
	cls      bool
	closed   bool
	ctx      context.Context // no better alternative to pass context into Next() method
}

// Commit transaction.
func (tx *SQLiteTx) Commit() error {
	_, err := tx.c.exec(context.Background(), "COMMIT", nil)
	if err != nil {
		// sqlite3 may leave the transaction open in this scenario.
		// However, database/sql considers the transaction complete once we
		// return from Commit() - we must clean up to honour its semantics.
		// We don't know if the ROLLBACK is strictly necessary, but according
		// to sqlite's docs, there is no harm in calling ROLLBACK unnecessarily.
		tx.c.exec(context.Background(), "ROLLBACK", nil)
	}
	return err
}

// Rollback transaction.
func (tx *SQLiteTx) Rollback() error {
	_, err := tx.c.exec(context.Background(), "ROLLBACK", nil)
	return err
}

// AutoCommit return which currently auto commit or not.
func (c *SQLiteConn) AutoCommit() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return int(cc.Xsqlite3_get_autocommit(c.tls, c.db)) != 0
}

func (c *SQLiteConn) lastError() error {
	return lastError(c.tls, c.db)
}

// Note: may be called with db == nil
func lastError(tls *libc.TLS, db uintptr) error {
	rv := cc.Xsqlite3_errcode(tls, db) // returns SQLITE_NOMEM if db == nil
	if rv == cc.SQLITE_OK {
		return nil
	}
	extrv := cc.Xsqlite3_extended_errcode(tls, db)       // returns SQLITE_NOMEM if db == nil
	errStr := libc.GoString(cc.Xsqlite3_errmsg(tls, db)) // returns "out of memory" if db == nil

	// https://www.sqlite.org/c3ref/system_errno.html
	// sqlite3_system_errno is only meaningful if the error code was SQLITE_CANTOPEN,
	// or it was SQLITE_IOERR and the extended code was not SQLITE_IOERR_NOMEM
	var systemErrno syscall.Errno
	if rv == cc.SQLITE_CANTOPEN || (rv == cc.SQLITE_IOERR && extrv != cc.SQLITE_IOERR_NOMEM) {
		systemErrno = syscall.Errno(cc.Xsqlite3_system_errno(tls, db))
	}

	return Error{
		Code:         ErrNo(rv),
		ExtendedCode: ErrNoExtended(extrv),
		SystemErrno:  systemErrno,
		err:          errStr,
	}
}

// Exec implements Execer.
func (c *SQLiteConn) Exec(query string, args []driver.Value) (driver.Result, error) {
	list := make([]driver.NamedValue, len(args))
	for i, v := range args {
		list[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}
	return c.exec(context.Background(), query, list)
}

func (c *SQLiteConn) exec(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	start := 0
	for {
		s, err := c.prepare(ctx, query)
		if err != nil {
			return nil, err
		}
		var res driver.Result
		if s.(*SQLiteStmt).s != 0 {
			stmtArgs := make([]driver.NamedValue, 0, len(args))
			na := s.NumInput()
			if len(args)-start < na {
				s.Close()
				return nil, fmt.Errorf("not enough args to execute query: want %d got %d", na, len(args))
			}
			// consume the number of arguments used in the current
			// statement and append all named arguments not
			// contained therein
			if len(args[start:start+na]) > 0 {
				stmtArgs = append(stmtArgs, args[start:start+na]...)
				for i := range args {
					if (i < start || i >= na) && args[i].Name != "" {
						stmtArgs = append(stmtArgs, args[i])
					}
				}
				for i := range stmtArgs {
					stmtArgs[i].Ordinal = i + 1
				}
			}
			res, err = s.(*SQLiteStmt).exec(ctx, stmtArgs)
			if err != nil && err != driver.ErrSkip {
				s.Close()
				return nil, err
			}
			start += na
		}
		tail := s.(*SQLiteStmt).t
		s.Close()
		if tail == "" {
			if res == nil {
				// https://github.com/mattn/go-sqlite3/issues/963
				res = &SQLiteResult{0, 0}
			}
			return res, nil
		}
		query = tail
	}
}

// Query implements Queryer.
func (c *SQLiteConn) Query(query string, args []driver.Value) (driver.Rows, error) {
	list := make([]driver.NamedValue, len(args))
	for i, v := range args {
		list[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}
	return c.query(context.Background(), query, list)
}

func (c *SQLiteConn) query(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	start := 0
	for {
		stmtArgs := make([]driver.NamedValue, 0, len(args))
		s, err := c.prepare(ctx, query)
		if err != nil {
			return nil, err
		}
		s.(*SQLiteStmt).cls = true
		na := s.NumInput()
		if len(args)-start < na {
			return nil, fmt.Errorf("not enough args to execute query: want %d got %d", na, len(args)-start)
		}
		// consume the number of arguments used in the current
		// statement and append all named arguments not contained
		// therein
		stmtArgs = append(stmtArgs, args[start:start+na]...)
		for i := range args {
			if (i < start || i >= na) && args[i].Name != "" {
				stmtArgs = append(stmtArgs, args[i])
			}
		}
		for i := range stmtArgs {
			stmtArgs[i].Ordinal = i + 1
		}
		rows, err := s.(*SQLiteStmt).query(ctx, stmtArgs)
		if err != nil && err != driver.ErrSkip {
			s.Close()
			return rows, err
		}
		start += na
		tail := s.(*SQLiteStmt).t
		if tail == "" {
			return rows, nil
		}
		rows.Close()
		s.Close()
		query = tail
	}
}

// Begin transaction.
func (c *SQLiteConn) Begin() (driver.Tx, error) {
	return c.begin(context.Background())
}

func (c *SQLiteConn) begin(ctx context.Context) (driver.Tx, error) {
	if _, err := c.exec(ctx, c.txlock, nil); err != nil {
		return nil, err
	}
	return &SQLiteTx{c}, nil
}

// Open database and return a new connection.
//
// A pragma can take either zero or one argument.
// The argument is may be either in parentheses or it may be separated from
// the pragma name by an equal sign. The two syntaxes yield identical results.
// In many pragmas, the argument is a boolean. The boolean can be one of:
//
//	1 yes true on
//	0 no false off
//
// You can specify a DSN string using a URI as the filename.
//
//	test.db
//	file:test.db?cache=shared&mode=memory
//	:memory:
//	file::memory:
//
//	mode
//	  Access mode of the database.
//	  https://www.sqlite.org/c3ref/open.html
//	  Values:
//	   - ro
//	   - rw
//	   - rwc
//	   - memory
//
//	cache
//	  SQLite Shared-Cache Mode
//	  https://www.sqlite.org/sharedcache.html
//	  Values:
//	    - shared
//	    - private
//
//	immutable=Boolean
//	  The immutable parameter is a boolean query parameter that indicates
//	  that the database file is stored on read-only media. When immutable is set,
//	  SQLite assumes that the database file cannot be changed,
//	  even by a process with higher privilege,
//	  and so the database is opened read-only and all locking and change detection is disabled.
//	  Caution: Setting the immutable property on a database file that
//	  does in fact change can result in incorrect query results and/or SQLITE_CORRUPT errors.
//
// go-sqlite3 adds the following query parameters to those used by SQLite:
//
//	_loc=XXX
//	  Specify location of time format. It's possible to specify "auto".
//
//	_mutex=XXX
//	  Specify mutex mode. XXX can be "no", "full".
//
//	_txlock=XXX
//	  Specify locking behavior for transactions.  XXX can be "immediate",
//	  "deferred", "exclusive".
//
//	_auto_vacuum=X | _vacuum=X
//	  0 | none - Auto Vacuum disabled
//	  1 | full - Auto Vacuum FULL
//	  2 | incremental - Auto Vacuum Incremental
//
//	_busy_timeout=XXX"| _timeout=XXX
//	  Specify value for sqlite3_busy_timeout.
//
//	_case_sensitive_like=Boolean | _cslike=Boolean
//	  https://www.sqlite.org/pragma.html#pragma_case_sensitive_like
//	  Default or disabled the LIKE operation is case-insensitive.
//	  When enabling this options behaviour of LIKE will become case-sensitive.
//
//	_defer_foreign_keys=Boolean | _defer_fk=Boolean
//	  Defer Foreign Keys until outermost transaction is committed.
//
//	_foreign_keys=Boolean | _fk=Boolean
//	  Enable or disable enforcement of foreign keys.
//
//	_ignore_check_constraints=Boolean
//	  This pragma enables or disables the enforcement of CHECK constraints.
//	  The default setting is off, meaning that CHECK constraints are enforced by default.
//
//	_journal_mode=MODE | _journal=MODE
//	  Set journal mode for the databases associated with the current connection.
//	  https://www.sqlite.org/pragma.html#pragma_journal_mode
//
//	_locking_mode=X | _locking=X
//	  Sets the database connection locking-mode.
//	  The locking-mode is either NORMAL or EXCLUSIVE.
//	  https://www.sqlite.org/pragma.html#pragma_locking_mode
//
//	_query_only=Boolean
//	  The query_only pragma prevents all changes to database files when enabled.
//
//	_recursive_triggers=Boolean | _rt=Boolean
//	  Enable or disable recursive triggers.
//
//	_secure_delete=Boolean|FAST
//	  When secure_delete is on, SQLite overwrites deleted content with zeros.
//	  https://www.sqlite.org/pragma.html#pragma_secure_delete
//
//	_synchronous=X | _sync=X
//	  Change the setting of the "synchronous" flag.
//	  https://www.sqlite.org/pragma.html#pragma_synchronous
//
//	_writable_schema=Boolean
//	  When this pragma is on, the SQLITE_MASTER tables in which database
//	  can be changed using ordinary UPDATE, INSERT, and DELETE statements.
//	  Warning: misuse of this pragma can easily result in a corrupt database file.
func (d *SQLiteDriver) Open(dsn string) (driver.Conn, error) {
	fmt.Println("=== OPEN", dsn)
	if cc.Xsqlite3_threadsafe(d.tls) == 0 {
		return nil, errors.New("sqlite library was not compiled for thread-safe operation")
	}

	var pkey string

	// Options
	var loc *time.Location
	mutex := int32(cc.SQLITE_OPEN_FULLMUTEX)
	txlock := "BEGIN"

	// PRAGMA's
	autoVacuum := -1
	busyTimeout := 5000
	caseSensitiveLike := -1
	deferForeignKeys := -1
	foreignKeys := -1
	ignoreCheckConstraints := -1
	var journalMode string
	lockingMode := "NORMAL"
	queryOnly := -1
	recursiveTriggers := -1
	secureDelete := "DEFAULT"
	synchronousMode := "NORMAL"
	writableSchema := -1
	var cacheSize *int64

	pos := strings.IndexRune(dsn, '?')
	if pos >= 1 {
		params, err := url.ParseQuery(dsn[pos+1:])
		if err != nil {
			return nil, err
		}

		// _loc
		if val := params.Get("_loc"); val != "" {
			switch strings.ToLower(val) {
			case "auto":
				loc = time.Local
			default:
				loc, err = time.LoadLocation(val)
				if err != nil {
					return nil, fmt.Errorf("Invalid _loc: %v: %v", val, err)
				}
			}
		}

		// _mutex
		if val := params.Get("_mutex"); val != "" {
			switch strings.ToLower(val) {
			case "no":
				mutex = cc.SQLITE_OPEN_NOMUTEX
			case "full":
				mutex = cc.SQLITE_OPEN_FULLMUTEX
			default:
				return nil, fmt.Errorf("Invalid _mutex: %v", val)
			}
		}

		// _txlock
		if val := params.Get("_txlock"); val != "" {
			switch strings.ToLower(val) {
			case "immediate":
				txlock = "BEGIN IMMEDIATE"
			case "exclusive":
				txlock = "BEGIN EXCLUSIVE"
			case "deferred":
				txlock = "BEGIN"
			default:
				return nil, fmt.Errorf("Invalid _txlock: %v", val)
			}
		}

		// Auto Vacuum (_vacuum)
		//
		// https://www.sqlite.org/pragma.html#pragma_auto_vacuum
		//
		pkey = "" // Reset pkey
		if _, ok := params["_auto_vacuum"]; ok {
			pkey = "_auto_vacuum"
		}
		if _, ok := params["_vacuum"]; ok {
			pkey = "_vacuum"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToLower(val) {
			case "0", "none":
				autoVacuum = 0
			case "1", "full":
				autoVacuum = 1
			case "2", "incremental":
				autoVacuum = 2
			default:
				return nil, fmt.Errorf("Invalid _auto_vacuum: %v, expecting value of '0 NONE 1 FULL 2 INCREMENTAL'", val)
			}
		}

		// Busy Timeout (_busy_timeout)
		//
		// https://www.sqlite.org/pragma.html#pragma_busy_timeout
		//
		pkey = "" // Reset pkey
		if _, ok := params["_busy_timeout"]; ok {
			pkey = "_busy_timeout"
		}
		if _, ok := params["_timeout"]; ok {
			pkey = "_timeout"
		}
		if val := params.Get(pkey); val != "" {
			iv, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("Invalid _busy_timeout: %v: %v", val, err)
			}
			busyTimeout = int(iv)
		}

		// Case Sensitive Like (_cslike)
		//
		// https://www.sqlite.org/pragma.html#pragma_case_sensitive_like
		//
		pkey = "" // Reset pkey
		if _, ok := params["_case_sensitive_like"]; ok {
			pkey = "_case_sensitive_like"
		}
		if _, ok := params["_cslike"]; ok {
			pkey = "_cslike"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				caseSensitiveLike = 0
			case "1", "yes", "true", "on":
				caseSensitiveLike = 1
			default:
				return nil, fmt.Errorf("Invalid _case_sensitive_like: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Defer Foreign Keys (_defer_foreign_keys | _defer_fk)
		//
		// https://www.sqlite.org/pragma.html#pragma_defer_foreign_keys
		//
		pkey = "" // Reset pkey
		if _, ok := params["_defer_foreign_keys"]; ok {
			pkey = "_defer_foreign_keys"
		}
		if _, ok := params["_defer_fk"]; ok {
			pkey = "_defer_fk"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				deferForeignKeys = 0
			case "1", "yes", "true", "on":
				deferForeignKeys = 1
			default:
				return nil, fmt.Errorf("Invalid _defer_foreign_keys: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Foreign Keys (_foreign_keys | _fk)
		//
		// https://www.sqlite.org/pragma.html#pragma_foreign_keys
		//
		pkey = "" // Reset pkey
		if _, ok := params["_foreign_keys"]; ok {
			pkey = "_foreign_keys"
		}
		if _, ok := params["_fk"]; ok {
			pkey = "_fk"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				foreignKeys = 0
			case "1", "yes", "true", "on":
				foreignKeys = 1
			default:
				return nil, fmt.Errorf("Invalid _foreign_keys: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Ignore CHECK Constrains (_ignore_check_constraints)
		//
		// https://www.sqlite.org/pragma.html#pragma_ignore_check_constraints
		//
		if val := params.Get("_ignore_check_constraints"); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				ignoreCheckConstraints = 0
			case "1", "yes", "true", "on":
				ignoreCheckConstraints = 1
			default:
				return nil, fmt.Errorf("Invalid _ignore_check_constraints: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Journal Mode (_journal_mode | _journal)
		//
		// https://www.sqlite.org/pragma.html#pragma_journal_mode
		//
		pkey = "" // Reset pkey
		if _, ok := params["_journal_mode"]; ok {
			pkey = "_journal_mode"
		}
		if _, ok := params["_journal"]; ok {
			pkey = "_journal"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToUpper(val) {
			case "DELETE", "TRUNCATE", "PERSIST", "MEMORY", "OFF":
				journalMode = strings.ToUpper(val)
			case "WAL":
				journalMode = strings.ToUpper(val)

				// For WAL Mode set Synchronous Mode to 'NORMAL'
				// See https://www.sqlite.org/pragma.html#pragma_synchronous
				synchronousMode = "NORMAL"
			default:
				return nil, fmt.Errorf("Invalid _journal: %v, expecting value of 'DELETE TRUNCATE PERSIST MEMORY WAL OFF'", val)
			}
		}

		// Locking Mode (_locking)
		//
		// https://www.sqlite.org/pragma.html#pragma_locking_mode
		//
		pkey = "" // Reset pkey
		if _, ok := params["_locking_mode"]; ok {
			pkey = "_locking_mode"
		}
		if _, ok := params["_locking"]; ok {
			pkey = "_locking"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToUpper(val) {
			case "NORMAL", "EXCLUSIVE":
				lockingMode = strings.ToUpper(val)
			default:
				return nil, fmt.Errorf("Invalid _locking_mode: %v, expecting value of 'NORMAL EXCLUSIVE", val)
			}
		}

		// Query Only (_query_only)
		//
		// https://www.sqlite.org/pragma.html#pragma_query_only
		//
		if val := params.Get("_query_only"); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				queryOnly = 0
			case "1", "yes", "true", "on":
				queryOnly = 1
			default:
				return nil, fmt.Errorf("Invalid _query_only: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Recursive Triggers (_recursive_triggers)
		//
		// https://www.sqlite.org/pragma.html#pragma_recursive_triggers
		//
		pkey = "" // Reset pkey
		if _, ok := params["_recursive_triggers"]; ok {
			pkey = "_recursive_triggers"
		}
		if _, ok := params["_rt"]; ok {
			pkey = "_rt"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				recursiveTriggers = 0
			case "1", "yes", "true", "on":
				recursiveTriggers = 1
			default:
				return nil, fmt.Errorf("Invalid _recursive_triggers: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Secure Delete (_secure_delete)
		//
		// https://www.sqlite.org/pragma.html#pragma_secure_delete
		//
		if val := params.Get("_secure_delete"); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				secureDelete = "OFF"
			case "1", "yes", "true", "on":
				secureDelete = "ON"
			case "fast":
				secureDelete = "FAST"
			default:
				return nil, fmt.Errorf("Invalid _secure_delete: %v, expecting boolean value of '0 1 false true no yes off on fast'", val)
			}
		}

		// Synchronous Mode (_synchronous | _sync)
		//
		// https://www.sqlite.org/pragma.html#pragma_synchronous
		//
		pkey = "" // Reset pkey
		if _, ok := params["_synchronous"]; ok {
			pkey = "_synchronous"
		}
		if _, ok := params["_sync"]; ok {
			pkey = "_sync"
		}
		if val := params.Get(pkey); val != "" {
			switch strings.ToUpper(val) {
			case "0", "OFF", "1", "NORMAL", "2", "FULL", "3", "EXTRA":
				synchronousMode = strings.ToUpper(val)
			default:
				return nil, fmt.Errorf("Invalid _synchronous: %v, expecting value of '0 OFF 1 NORMAL 2 FULL 3 EXTRA'", val)
			}
		}

		// Writable Schema (_writeable_schema)
		//
		// https://www.sqlite.org/pragma.html#pragma_writeable_schema
		//
		if val := params.Get("_writable_schema"); val != "" {
			switch strings.ToLower(val) {
			case "0", "no", "false", "off":
				writableSchema = 0
			case "1", "yes", "true", "on":
				writableSchema = 1
			default:
				return nil, fmt.Errorf("Invalid _writable_schema: %v, expecting boolean value of '0 1 false true no yes off on'", val)
			}
		}

		// Cache size (_cache_size)
		//
		// https://sqlite.org/pragma.html#pragma_cache_size
		//
		if val := params.Get("_cache_size"); val != "" {
			iv, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("Invalid _cache_size: %v: %v", val, err)
			}
			cacheSize = &iv
		}

		if !strings.HasPrefix(dsn, "file:") {
			dsn = dsn[:pos]
		}
	}

	p := libc.Xmalloc(d.tls, types.Size_t(unsafe.Sizeof(uintptr(0))))
	defer libc.Xfree(d.tls, p)
	tls := libc.NewTLS()
	name, _ := libc.CString(dsn)
	defer libc.Xfree(tls, name)
	fmt.Println("OPEN NAME", dsn)
	rv := cc.Xsqlite3_open_v2(tls, name, p,
		mutex|cc.SQLITE_OPEN_READWRITE|cc.SQLITE_OPEN_CREATE|cc.SQLITE_OPEN_URI,
		0)
	db := *(*uintptr)(unsafe.Pointer(p))
	if rv != 0 {
		// Save off the error _before_ closing the database.
		// This is safe even if db is nil.
		err := lastError(tls, db)
		if db != 0 {
			cc.Xsqlite3_close_v2(tls, db)
		}
		return nil, err
	}
	fmt.Println(">>>>> OPEN V2, DB=", db)
	if db == 0 {
		return nil, errors.New("sqlite succeeded without returning a database")
	}

	exec := func(s string) error {
		cs, _ := libc.CString(s)
		rv := cc.Xsqlite3_exec(tls, db, cs, 0, 0, 0)
		libc.Xfree(tls, cs)
		if rv != cc.SQLITE_OK {
			return lastError(tls, db)
		}
		return nil
	}

	// Busy timeout
	if err := exec(fmt.Sprintf("PRAGMA busy_timeout = %d;", busyTimeout)); err != nil {
		cc.Xsqlite3_close_v2(tls, db)
		return nil, err
	}

	// USER AUTHENTICATION
	//
	// User Authentication is always performed even when
	// sqlite_userauth is not compiled in, because without user authentication
	// the authentication is a no-op.
	//
	// Workflow
	//	- Authenticate
	//		ON::SUCCESS		=> Continue
	//		ON::SQLITE_AUTH => Return error and exit Open(...)
	//
	//  - Activate User Authentication
	//		Check if the user wants to activate User Authentication.
	//		If so then first create a temporary AuthConn to the database
	//		This is possible because we are already successfully authenticated.
	//
	//	- Check if `sqlite_user`` table exists
	//		YES				=> Add the provided user from DSN as Admin User and
	//						   activate user authentication.
	//		NO				=> Continue
	//

	// Create connection to SQLite
	conn := &SQLiteConn{db: db, tls: tls, loc: loc, txlock: txlock}

	// Auto Vacuum
	// Moved auto_vacuum command, the user preference for auto_vacuum needs to be implemented directly after
	// the authentication and before the sqlite_user table gets created if the user
	// decides to activate User Authentication because
	// auto_vacuum needs to be set before any tables are created
	// and activating user authentication creates the internal table `sqlite_user`.
	if autoVacuum > -1 {
		if err := exec(fmt.Sprintf("PRAGMA auto_vacuum = %d;", autoVacuum)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Case Sensitive LIKE
	if caseSensitiveLike > -1 {
		if err := exec(fmt.Sprintf("PRAGMA case_sensitive_like = %d;", caseSensitiveLike)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Defer Foreign Keys
	if deferForeignKeys > -1 {
		if err := exec(fmt.Sprintf("PRAGMA defer_foreign_keys = %d;", deferForeignKeys)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Foreign Keys
	if foreignKeys > -1 {
		if err := exec(fmt.Sprintf("PRAGMA foreign_keys = %d;", foreignKeys)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Ignore CHECK Constraints
	if ignoreCheckConstraints > -1 {
		if err := exec(fmt.Sprintf("PRAGMA ignore_check_constraints = %d;", ignoreCheckConstraints)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Journal Mode
	if journalMode != "" {
		if err := exec(fmt.Sprintf("PRAGMA journal_mode = %s;", journalMode)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Locking Mode
	// Because the default is NORMAL and this is not changed in this package
	// by using the compile time SQLITE_DEFAULT_LOCKING_MODE this PRAGMA can always be executed
	if err := exec(fmt.Sprintf("PRAGMA locking_mode = %s;", lockingMode)); err != nil {
		cc.Xsqlite3_close_v2(tls, db)
		return nil, err
	}

	// Query Only
	if queryOnly > -1 {
		if err := exec(fmt.Sprintf("PRAGMA query_only = %d;", queryOnly)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Recursive Triggers
	if recursiveTriggers > -1 {
		if err := exec(fmt.Sprintf("PRAGMA recursive_triggers = %d;", recursiveTriggers)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Secure Delete
	//
	// Because this package can set the compile time flag SQLITE_SECURE_DELETE with a build tag
	// the default value for secureDelete var is 'DEFAULT' this way
	// you can compile with secure_delete 'ON' and disable it for a specific database connection.
	if secureDelete != "DEFAULT" {
		if err := exec(fmt.Sprintf("PRAGMA secure_delete = %s;", secureDelete)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Synchronous Mode
	//
	// Because default is NORMAL this statement is always executed
	if err := exec(fmt.Sprintf("PRAGMA synchronous = %s;", synchronousMode)); err != nil {
		conn.Close()
		return nil, err
	}

	// Writable Schema
	if writableSchema > -1 {
		if err := exec(fmt.Sprintf("PRAGMA writable_schema = %d;", writableSchema)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	// Cache Size
	if cacheSize != nil {
		if err := exec(fmt.Sprintf("PRAGMA cache_size = %d;", *cacheSize)); err != nil {
			cc.Xsqlite3_close_v2(tls, db)
			return nil, err
		}
	}

	runtime.SetFinalizer(conn, (*SQLiteConn).Close)
	return conn, nil
}

// Close the connection.
func (c *SQLiteConn) Close() error {
	rv := cc.Xsqlite3_close_v2(c.tls, c.db)
	if rv != cc.SQLITE_OK {
		return c.lastError()
	}
	c.mu.Lock()
	c.db = 0
	c.mu.Unlock()
	runtime.SetFinalizer(c, nil)
	return nil
}

func (c *SQLiteConn) dbConnOpen() bool {
	if c == nil {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.db != 0
}

// Prepare the query string. Return a new statement.
func (c *SQLiteConn) Prepare(query string) (driver.Stmt, error) {
	return c.prepare(context.Background(), query)
}

func (c *SQLiteConn) prepare(ctx context.Context, query string) (driver.Stmt, error) {
	pquery, _ := libc.CString(query)
	defer libc.Xfree(c.tls, pquery)
	var s uintptr
	var tail uintptr
	var t string
	p := libc.Xmalloc(c.tls, types.Size_t(unsafe.Sizeof(uintptr(0))))
	defer libc.Xfree(c.tls, p)
	rv := cc.Xsqlite3_prepare_v2(c.tls, c.db, pquery, int32(-1), p, uintptr(unsafe.Pointer(&tail)))
	if rv != cc.SQLITE_OK {
		return nil, c.lastError()
	}
	s = *(*uintptr)(unsafe.Pointer(p))
	if tail != 0 /*&& *tail != '\000'*/ {
		t = strings.TrimSpace(libc.GoString(tail))
	}
	ss := &SQLiteStmt{c: c, s: s, t: t}
	runtime.SetFinalizer(ss, (*SQLiteStmt).Close)
	return ss, nil
}

// Close the statement.
func (s *SQLiteStmt) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	if !s.c.dbConnOpen() {
		return errors.New("sqlite statement with already closed database connection")
	}
	rv := cc.Xsqlite3_finalize(s.c.tls, s.s)
	s.s = 0
	if rv != cc.SQLITE_OK {
		return s.c.lastError()
	}
	s.c = nil
	runtime.SetFinalizer(s, nil)
	return nil
}

// NumInput return a number of parameters.
func (s *SQLiteStmt) NumInput() int {
	return int(cc.Xsqlite3_bind_parameter_count(s.c.tls, s.s))
}

var placeHolder = []byte{0}

func (s *SQLiteStmt) bind(args []driver.NamedValue) error {
	rv := cc.Xsqlite3_reset(s.c.tls, s.s)
	if rv != cc.SQLITE_ROW && rv != cc.SQLITE_OK && rv != cc.SQLITE_DONE {
		return s.c.lastError()
	}

	bindIndices := make([][3]int, len(args))
	prefixes := []string{":", "@", "$"}
	for i, v := range args {
		bindIndices[i][0] = args[i].Ordinal
		if v.Name != "" {
			for j := range prefixes {
				cname, _ := libc.CString(prefixes[j] + v.Name)
				bindIndices[i][j] = int(cc.Xsqlite3_bind_parameter_index(s.c.tls, s.s, cname))
				libc.Xfree(s.c.tls, cname)
			}
			args[i].Ordinal = bindIndices[i][0]
		}
	}

	for i, arg := range args {
		for j := range bindIndices[i] {
			if bindIndices[i][j] == 0 {
				continue
			}
			n := int32(bindIndices[i][j])
			switch v := arg.Value.(type) {
			case nil:
				rv = cc.Xsqlite3_bind_null(s.c.tls, s.s, n)
			case string:
				if len(v) == 0 {
					rv = cc.Xsqlite3_bind_text(s.c.tls, s.s, n, uintptr(unsafe.Pointer(&placeHolder[0])), int32(0), SQLITE_TRANSIENT)
				} else {
					b := []byte(v)
					rv = cc.Xsqlite3_bind_text(s.c.tls, s.s, n, uintptr(unsafe.Pointer(&b[0])), int32(len(b)), SQLITE_TRANSIENT)
				}
			case int64:
				rv = cc.Xsqlite3_bind_int64(s.c.tls, s.s, n, v)
			case bool:
				if v {
					rv = cc.Xsqlite3_bind_int(s.c.tls, s.s, n, 1)
				} else {
					rv = cc.Xsqlite3_bind_int(s.c.tls, s.s, n, 0)
				}
			case float64:
				rv = cc.Xsqlite3_bind_double(s.c.tls, s.s, n, v)
			case []byte:
				if v == nil {
					rv = cc.Xsqlite3_bind_null(s.c.tls, s.s, n)
				} else {
					ln := len(v)
					if ln == 0 {
						v = placeHolder
					}
					rv = cc.Xsqlite3_bind_blob(s.c.tls, s.s, n, uintptr(unsafe.Pointer(&v[0])), int32(ln), SQLITE_TRANSIENT)
				}
			case time.Time:
				b := []byte(v.Format(SQLiteTimestampFormats[0]))
				rv = cc.Xsqlite3_bind_text(s.c.tls, s.s, n, uintptr(unsafe.Pointer(&b[0])), int32(len(b)), SQLITE_TRANSIENT)
			}
			if rv != cc.SQLITE_OK {
				return s.c.lastError()
			}
		}
	}
	return nil
}

// Query the statement with arguments. Return records.
func (s *SQLiteStmt) Query(args []driver.Value) (driver.Rows, error) {
	list := make([]driver.NamedValue, len(args))
	for i, v := range args {
		list[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}
	return s.query(context.Background(), list)
}

func (s *SQLiteStmt) query(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	if err := s.bind(args); err != nil {
		return nil, err
	}

	rows := &SQLiteRows{
		s:        s,
		nc:       int(cc.Xsqlite3_column_count(s.c.tls, s.s)),
		cols:     nil,
		decltype: nil,
		cls:      s.cls,
		closed:   false,
		ctx:      ctx,
	}
	runtime.SetFinalizer(rows, (*SQLiteRows).Close)

	return rows, nil
}

// LastInsertId return last inserted ID.
func (r *SQLiteResult) LastInsertId() (int64, error) {
	return r.id, nil
}

// RowsAffected return how many rows affected.
func (r *SQLiteResult) RowsAffected() (int64, error) {
	return r.changes, nil
}

// Exec execute the statement with arguments. Return result object.
func (s *SQLiteStmt) Exec(args []driver.Value) (driver.Result, error) {
	list := make([]driver.NamedValue, len(args))
	for i, v := range args {
		list[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}
	return s.exec(context.Background(), list)
}

func isInterruptErr(err error) bool {
	sqliteErr, ok := err.(Error)
	if ok {
		return sqliteErr.Code == ErrInterrupt
	}
	return false
}

// exec executes a query that doesn't return rows. Attempts to honor context timeout.
func (s *SQLiteStmt) exec(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	if ctx.Done() == nil {
		return s.execSync(args)
	}

	type result struct {
		r   driver.Result
		err error
	}
	resultCh := make(chan result)
	defer close(resultCh)
	go func() {
		r, err := s.execSync(args)
		resultCh <- result{r, err}
	}()
	var rv result
	select {
	case rv = <-resultCh:
	case <-ctx.Done():
		select {
		case rv = <-resultCh: // no need to interrupt, operation completed in db
		default:
			// this is still racy and can be no-op if executed between sqlite3_* calls in execSync.
			cc.Xsqlite3_interrupt(s.c.tls, s.c.db)
			rv = <-resultCh // wait for goroutine completed
			if isInterruptErr(rv.err) {
				return nil, ctx.Err()
			}
		}
	}
	return rv.r, rv.err
}

func (s *SQLiteStmt) execSync(args []driver.NamedValue) (driver.Result, error) {
	if err := s.bind(args); err != nil {
		cc.Xsqlite3_reset(s.c.tls, s.s)
		cc.Xsqlite3_clear_bindings(s.c.tls, s.s)
		return nil, err
	}

	rv := cc.Xsqlite3_step(s.c.tls, s.s)
	rowid := cc.Xsqlite3_last_insert_rowid(s.c.tls, s.c.db)
	changes := cc.Xsqlite3_changes(s.c.tls, s.c.db)

	if rv != cc.SQLITE_ROW && rv != cc.SQLITE_OK && rv != cc.SQLITE_DONE {
		err := s.c.lastError()
		cc.Xsqlite3_reset(s.c.tls, s.s)
		cc.Xsqlite3_clear_bindings(s.c.tls, s.s)
		return nil, err
	}

	return &SQLiteResult{id: int64(rowid), changes: int64(changes)}, nil
}

// Readonly reports if this statement is considered readonly by SQLite.
//
// See: https://sqlite.org/c3ref/stmt_readonly.html
func (s *SQLiteStmt) Readonly() bool {
	return cc.Xsqlite3_stmt_readonly(s.c.tls, s.s) == 1
}

// Close the rows.
func (rc *SQLiteRows) Close() error {
	rc.s.mu.Lock()
	if rc.s.closed || rc.closed {
		rc.s.mu.Unlock()
		return nil
	}
	rc.closed = true
	if rc.cls {
		rc.s.mu.Unlock()
		return rc.s.Close()
	}
	rv := cc.Xsqlite3_reset(rc.s.c.tls, rc.s.s)
	if rv != cc.SQLITE_OK {
		rc.s.mu.Unlock()
		return rc.s.c.lastError()
	}
	rc.s.mu.Unlock()
	rc.s = nil
	runtime.SetFinalizer(rc, nil)
	return nil
}

// Columns return column names.
func (rc *SQLiteRows) Columns() []string {
	rc.s.mu.Lock()
	defer rc.s.mu.Unlock()
	if rc.s.s != 0 && rc.nc != len(rc.cols) {
		rc.cols = make([]string, rc.nc)
		for i := 0; i < rc.nc; i++ {
			rc.cols[i] = libc.GoString(cc.Xsqlite3_column_name(rc.s.c.tls, rc.s.s, int32(i)))
		}
	}
	return rc.cols
}

func (rc *SQLiteRows) declTypes() []string {
	if rc.s.s != 0 && rc.decltype == nil {
		rc.decltype = make([]string, rc.nc)
		for i := 0; i < rc.nc; i++ {
			rc.decltype[i] = strings.ToLower(libc.GoString(cc.Xsqlite3_column_decltype(rc.s.c.tls, rc.s.s, int32(i))))
		}
	}
	return rc.decltype
}

// DeclTypes return column types.
func (rc *SQLiteRows) DeclTypes() []string {
	rc.s.mu.Lock()
	defer rc.s.mu.Unlock()
	return rc.declTypes()
}

// Next move cursor to next. Attempts to honor context timeout from QueryContext call.
func (rc *SQLiteRows) Next(dest []driver.Value) error {
	rc.s.mu.Lock()
	defer rc.s.mu.Unlock()

	if rc.s.closed {
		return io.EOF
	}

	if rc.ctx.Done() == nil {
		return rc.nextSyncLocked(dest)
	}
	resultCh := make(chan error)
	defer close(resultCh)
	go func() {
		resultCh <- rc.nextSyncLocked(dest)
	}()
	select {
	case err := <-resultCh:
		return err
	case <-rc.ctx.Done():
		select {
		case <-resultCh: // no need to interrupt
		default:
			// this is still racy and can be no-op if executed between sqlite3_* calls in nextSyncLocked.
			cc.Xsqlite3_interrupt(rc.s.c.tls, rc.s.c.db)
			<-resultCh // ensure goroutine completed
		}
		return rc.ctx.Err()
	}
}

// nextSyncLocked moves cursor to next; must be called with locked mutex.
func (rc *SQLiteRows) nextSyncLocked(dest []driver.Value) error {
	rv := cc.Xsqlite3_step(rc.s.c.tls, rc.s.s)
	if rv == cc.SQLITE_DONE {
		return io.EOF
	}
	if rv != cc.SQLITE_ROW {
		rv = cc.Xsqlite3_reset(rc.s.c.tls, rc.s.s)
		if rv != cc.SQLITE_OK {
			return rc.s.c.lastError()
		}
		return nil
	}

	rc.declTypes()

	for i := range dest {
		switch cc.Xsqlite3_column_type(rc.s.c.tls, rc.s.s, int32(i)) {
		case cc.SQLITE_INTEGER:
			val := int64(cc.Xsqlite3_column_int64(rc.s.c.tls, rc.s.s, int32(i)))
			switch rc.decltype[i] {
			case columnTimestamp, columnDatetime, columnDate:
				var t time.Time
				// Assume a millisecond unix timestamp if it's 13 digits -- too
				// large to be a reasonable timestamp in seconds.
				if val > 1e12 || val < -1e12 {
					val *= int64(time.Millisecond) // convert ms to nsec
					t = time.Unix(0, val)
				} else {
					t = time.Unix(val, 0)
				}
				t = t.UTC()
				if rc.s.c.loc != nil {
					t = t.In(rc.s.c.loc)
				}
				dest[i] = t
			case "boolean":
				dest[i] = val > 0
			default:
				dest[i] = val
			}
		case cc.SQLITE_FLOAT:
			dest[i] = float64(cc.Xsqlite3_column_double(rc.s.c.tls, rc.s.s, int32(i)))
		case cc.SQLITE_BLOB:
			p := cc.Xsqlite3_column_blob(rc.s.c.tls, rc.s.s, int32(i))
			if p == 0 {
				dest[i] = []byte{}
				continue
			}
			n := int(cc.Xsqlite3_column_bytes(rc.s.c.tls, rc.s.s, int32(i)))
			dest[i] = libc.GoBytes(p, n)
		case cc.SQLITE_NULL:
			dest[i] = nil
		case cc.SQLITE_TEXT:
			var err error
			var timeVal time.Time

			n := int(cc.Xsqlite3_column_bytes(rc.s.c.tls, rc.s.s, int32(i)))
			s := string(libc.GoBytes(cc.Xsqlite3_column_text(rc.s.c.tls, rc.s.s, int32(i)), n))

			switch rc.decltype[i] {
			case columnTimestamp, columnDatetime, columnDate:
				var t time.Time
				s = strings.TrimSuffix(s, "Z")
				for _, format := range SQLiteTimestampFormats {
					if timeVal, err = time.ParseInLocation(format, s, time.UTC); err == nil {
						t = timeVal
						break
					}
				}
				if err != nil {
					// The column is a time value, so return the zero time on parse failure.
					t = time.Time{}
				}
				if rc.s.c.loc != nil {
					t = t.In(rc.s.c.loc)
				}
				dest[i] = t
			default:
				dest[i] = s
			}
		}
	}
	return nil
}

// Ping implement Pinger.
func (c *SQLiteConn) Ping(ctx context.Context) error {
	if c.db == 0 {
		// must be ErrBadConn for sql to close the database
		return driver.ErrBadConn
	}
	return nil
}

// QueryContext implement QueryerContext.
func (c *SQLiteConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	return c.query(ctx, query, args)
}

// ExecContext implement ExecerContext.
func (c *SQLiteConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return c.exec(ctx, query, args)
}

// PrepareContext implement ConnPrepareContext.
func (c *SQLiteConn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	return c.prepare(ctx, query)
}

// BeginTx implement ConnBeginTx.
func (c *SQLiteConn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	return c.begin(ctx)
}

// QueryContext implement QueryerContext.
func (s *SQLiteStmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.query(ctx, args)
}

// ExecContext implement ExecerContext.
func (s *SQLiteStmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return s.exec(ctx, args)
}

// ColumnTypeDatabaseTypeName implement RowsColumnTypeDatabaseTypeName.
func (rc *SQLiteRows) ColumnTypeDatabaseTypeName(i int) string {
	return libc.GoString(cc.Xsqlite3_column_decltype(rc.s.c.tls, rc.s.s, int32(i)))
}

/*
func (rc *SQLiteRows) ColumnTypeLength(index int) (length int64, ok bool) {
	return 0, false
}

func (rc *SQLiteRows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return 0, 0, false
}
*/

// ColumnTypeNullable implement RowsColumnTypeNullable.
func (rc *SQLiteRows) ColumnTypeNullable(i int) (nullable, ok bool) {
	return true, true
}

// ColumnTypeScanType implement RowsColumnTypeScanType.
func (rc *SQLiteRows) ColumnTypeScanType(i int) reflect.Type {
	return scanType(libc.GoString(cc.Xsqlite3_column_decltype(rc.s.c.tls, rc.s.s, int32(i))))
}

const (
	SQLITE_INTEGER = iota
	SQLITE_TEXT
	SQLITE_BLOB
	SQLITE_REAL
	SQLITE_NUMERIC
	SQLITE_TIME
	SQLITE_BOOL
	SQLITE_NULL
)

func scanType(cdt string) reflect.Type {
	t := strings.ToUpper(cdt)
	i := databaseTypeConvSqlite(t)
	switch i {
	case SQLITE_INTEGER:
		return reflect.TypeOf(sql.NullInt64{})
	case SQLITE_TEXT:
		return reflect.TypeOf(sql.NullString{})
	case SQLITE_BLOB:
		return reflect.TypeOf(sql.RawBytes{})
	case SQLITE_REAL:
		return reflect.TypeOf(sql.NullFloat64{})
	case SQLITE_NUMERIC:
		return reflect.TypeOf(sql.NullFloat64{})
	case SQLITE_BOOL:
		return reflect.TypeOf(sql.NullBool{})
	case SQLITE_TIME:
		return reflect.TypeOf(sql.NullTime{})
	}
	return reflect.TypeOf(new(any))
}

func databaseTypeConvSqlite(t string) int {
	if strings.Contains(t, "INT") {
		return SQLITE_INTEGER
	}
	if t == "CLOB" || t == "TEXT" ||
		strings.Contains(t, "CHAR") {
		return SQLITE_TEXT
	}
	if t == "BLOB" {
		return SQLITE_BLOB
	}
	if t == "REAL" || t == "FLOAT" ||
		strings.Contains(t, "DOUBLE") {
		return SQLITE_REAL
	}
	if t == "DATE" || t == "DATETIME" ||
		t == "TIMESTAMP" {
		return SQLITE_TIME
	}
	if t == "NUMERIC" ||
		strings.Contains(t, "DECIMAL") {
		return SQLITE_NUMERIC
	}
	if t == "BOOLEAN" {
		return SQLITE_BOOL
	}

	return SQLITE_NULL
}
