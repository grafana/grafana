// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

/*
#cgo CFLAGS: -std=gnu99
#cgo CFLAGS: -DSQLITE_ENABLE_RTREE -DSQLITE_THREADSAFE
#cgo CFLAGS: -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS
#include <sqlite3-binding.h>
#include <stdlib.h>
#include <string.h>

#ifdef __CYGWIN__
# include <errno.h>
#endif

#ifndef SQLITE_OPEN_READWRITE
# define SQLITE_OPEN_READWRITE 0
#endif

#ifndef SQLITE_OPEN_FULLMUTEX
# define SQLITE_OPEN_FULLMUTEX 0
#endif

static int
_sqlite3_open_v2(const char *filename, sqlite3 **ppDb, int flags, const char *zVfs) {
#ifdef SQLITE_OPEN_URI
  return sqlite3_open_v2(filename, ppDb, flags | SQLITE_OPEN_URI, zVfs);
#else
  return sqlite3_open_v2(filename, ppDb, flags, zVfs);
#endif
}

static int
_sqlite3_bind_text(sqlite3_stmt *stmt, int n, char *p, int np) {
  return sqlite3_bind_text(stmt, n, p, np, SQLITE_TRANSIENT);
}

static int
_sqlite3_bind_blob(sqlite3_stmt *stmt, int n, void *p, int np) {
  return sqlite3_bind_blob(stmt, n, p, np, SQLITE_TRANSIENT);
}

#include <stdio.h>
#include <stdint.h>

static int
_sqlite3_exec(sqlite3* db, const char* pcmd, long* rowid, long* changes)
{
  int rv = sqlite3_exec(db, pcmd, 0, 0, 0);
  *rowid = (long) sqlite3_last_insert_rowid(db);
  *changes = (long) sqlite3_changes(db);
  return rv;
}

static int
_sqlite3_step(sqlite3_stmt* stmt, long* rowid, long* changes)
{
  int rv = sqlite3_step(stmt);
  sqlite3* db = sqlite3_db_handle(stmt);
  *rowid = (long) sqlite3_last_insert_rowid(db);
  *changes = (long) sqlite3_changes(db);
  return rv;
}

*/
import "C"
import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"time"
	"unsafe"
)

// Timestamp formats understood by both this module and SQLite.
// The first format in the slice will be used when saving time values
// into the database. When parsing a string from a timestamp or
// datetime column, the formats are tried in order.
var SQLiteTimestampFormats = []string{
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04:05",
	"2006-01-02T15:04:05",
	"2006-01-02 15:04",
	"2006-01-02T15:04",
	"2006-01-02",
	"2006-01-02 15:04:05-07:00",
}

func init() {
	sql.Register("sqlite3", &SQLiteDriver{})
}

// Return SQLite library Version information.
func Version() (libVersion string, libVersionNumber int, sourceId string) {
	libVersion = C.GoString(C.sqlite3_libversion())
	libVersionNumber = int(C.sqlite3_libversion_number())
	sourceId = C.GoString(C.sqlite3_sourceid())
	return libVersion, libVersionNumber, sourceId
}

// Driver struct.
type SQLiteDriver struct {
	Extensions  []string
	ConnectHook func(*SQLiteConn) error
}

// Conn struct.
type SQLiteConn struct {
	db  *C.sqlite3
	loc *time.Location
}

// Tx struct.
type SQLiteTx struct {
	c *SQLiteConn
}

// Stmt struct.
type SQLiteStmt struct {
	c      *SQLiteConn
	s      *C.sqlite3_stmt
	nv     int
	nn     []string
	t      string
	closed bool
	cls    bool
}

// Result struct.
type SQLiteResult struct {
	id      int64
	changes int64
}

// Rows struct.
type SQLiteRows struct {
	s        *SQLiteStmt
	nc       int
	cols     []string
	decltype []string
	cls      bool
}

// Commit transaction.
func (tx *SQLiteTx) Commit() error {
	_, err := tx.c.exec("COMMIT")
	return err
}

// Rollback transaction.
func (tx *SQLiteTx) Rollback() error {
	_, err := tx.c.exec("ROLLBACK")
	return err
}

// AutoCommit return which currently auto commit or not.
func (c *SQLiteConn) AutoCommit() bool {
	return int(C.sqlite3_get_autocommit(c.db)) != 0
}

func (c *SQLiteConn) lastError() Error {
	return Error{
		Code:         ErrNo(C.sqlite3_errcode(c.db)),
		ExtendedCode: ErrNoExtended(C.sqlite3_extended_errcode(c.db)),
		err:          C.GoString(C.sqlite3_errmsg(c.db)),
	}
}

// Implements Execer
func (c *SQLiteConn) Exec(query string, args []driver.Value) (driver.Result, error) {
	if len(args) == 0 {
		return c.exec(query)
	}

	for {
		s, err := c.Prepare(query)
		if err != nil {
			return nil, err
		}
		var res driver.Result
		if s.(*SQLiteStmt).s != nil {
			na := s.NumInput()
			if len(args) < na {
				return nil, fmt.Errorf("Not enough args to execute query. Expected %d, got %d.", na, len(args))
			}
			res, err = s.Exec(args[:na])
			if err != nil && err != driver.ErrSkip {
				s.Close()
				return nil, err
			}
			args = args[na:]
		}
		tail := s.(*SQLiteStmt).t
		s.Close()
		if tail == "" {
			return res, nil
		}
		query = tail
	}
}

// Implements Queryer
func (c *SQLiteConn) Query(query string, args []driver.Value) (driver.Rows, error) {
	for {
		s, err := c.Prepare(query)
		if err != nil {
			return nil, err
		}
		s.(*SQLiteStmt).cls = true
		na := s.NumInput()
		if len(args) < na {
			return nil, fmt.Errorf("Not enough args to execute query. Expected %d, got %d.", na, len(args))
		}
		rows, err := s.Query(args[:na])
		if err != nil && err != driver.ErrSkip {
			s.Close()
			return nil, err
		}
		args = args[na:]
		tail := s.(*SQLiteStmt).t
		if tail == "" {
			return rows, nil
		}
		rows.Close()
		s.Close()
		query = tail
	}
}

func (c *SQLiteConn) exec(cmd string) (driver.Result, error) {
	pcmd := C.CString(cmd)
	defer C.free(unsafe.Pointer(pcmd))

	var rowid, changes C.long
	rv := C._sqlite3_exec(c.db, pcmd, &rowid, &changes)
	if rv != C.SQLITE_OK {
		return nil, c.lastError()
	}
	return &SQLiteResult{int64(rowid), int64(changes)}, nil
}

// Begin transaction.
func (c *SQLiteConn) Begin() (driver.Tx, error) {
	if _, err := c.exec("BEGIN"); err != nil {
		return nil, err
	}
	return &SQLiteTx{c}, nil
}

func errorString(err Error) string {
	return C.GoString(C.sqlite3_errstr(C.int(err.Code)))
}

// Open database and return a new connection.
// You can specify DSN string with URI filename.
//   test.db
//   file:test.db?cache=shared&mode=memory
//   :memory:
//   file::memory:
// go-sqlite handle especially query parameters.
//   _loc=XXX
//     Specify location of time format. It's possible to specify "auto".
//   _busy_timeout=XXX
//     Specify value for sqlite3_busy_timeout.
func (d *SQLiteDriver) Open(dsn string) (driver.Conn, error) {
	if C.sqlite3_threadsafe() == 0 {
		return nil, errors.New("sqlite library was not compiled for thread-safe operation")
	}

	var loc *time.Location
	busy_timeout := 5000
	pos := strings.IndexRune(dsn, '?')
	if pos >= 1 {
		params, err := url.ParseQuery(dsn[pos+1:])
		if err != nil {
			return nil, err
		}

		// _loc
		if val := params.Get("_loc"); val != "" {
			if val == "auto" {
				loc = time.Local
			} else {
				loc, err = time.LoadLocation(val)
				if err != nil {
					return nil, fmt.Errorf("Invalid _loc: %v: %v", val, err)
				}
			}
		}

		// _busy_timeout
		if val := params.Get("_busy_timeout"); val != "" {
			iv, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("Invalid _busy_timeout: %v: %v", val, err)
			}
			busy_timeout = int(iv)
		}

		if !strings.HasPrefix(dsn, "file:") {
			dsn = dsn[:pos]
		}
	}

	var db *C.sqlite3
	name := C.CString(dsn)
	defer C.free(unsafe.Pointer(name))
	rv := C._sqlite3_open_v2(name, &db,
		C.SQLITE_OPEN_FULLMUTEX|
			C.SQLITE_OPEN_READWRITE|
			C.SQLITE_OPEN_CREATE,
		nil)
	if rv != 0 {
		return nil, Error{Code: ErrNo(rv)}
	}
	if db == nil {
		return nil, errors.New("sqlite succeeded without returning a database")
	}

	rv = C.sqlite3_busy_timeout(db, C.int(busy_timeout))
	if rv != C.SQLITE_OK {
		return nil, Error{Code: ErrNo(rv)}
	}

	conn := &SQLiteConn{db: db, loc: loc}

	if len(d.Extensions) > 0 {
		rv = C.sqlite3_enable_load_extension(db, 1)
		if rv != C.SQLITE_OK {
			return nil, errors.New(C.GoString(C.sqlite3_errmsg(db)))
		}

		for _, extension := range d.Extensions {
			cext := C.CString(extension)
			defer C.free(unsafe.Pointer(cext))
			rv = C.sqlite3_load_extension(db, cext, nil, nil)
			if rv != C.SQLITE_OK {
				return nil, errors.New(C.GoString(C.sqlite3_errmsg(db)))
			}
		}

		rv = C.sqlite3_enable_load_extension(db, 0)
		if rv != C.SQLITE_OK {
			return nil, errors.New(C.GoString(C.sqlite3_errmsg(db)))
		}
	}

	if d.ConnectHook != nil {
		if err := d.ConnectHook(conn); err != nil {
			return nil, err
		}
	}
	runtime.SetFinalizer(conn, (*SQLiteConn).Close)
	return conn, nil
}

// Close the connection.
func (c *SQLiteConn) Close() error {
	rv := C.sqlite3_close_v2(c.db)
	if rv != C.SQLITE_OK {
		return c.lastError()
	}
	c.db = nil
	runtime.SetFinalizer(c, nil)
	return nil
}

// Prepare query string. Return a new statement.
func (c *SQLiteConn) Prepare(query string) (driver.Stmt, error) {
	pquery := C.CString(query)
	defer C.free(unsafe.Pointer(pquery))
	var s *C.sqlite3_stmt
	var tail *C.char
	rv := C.sqlite3_prepare_v2(c.db, pquery, -1, &s, &tail)
	if rv != C.SQLITE_OK {
		return nil, c.lastError()
	}
	var t string
	if tail != nil && *tail != '\000' {
		t = strings.TrimSpace(C.GoString(tail))
	}
	nv := int(C.sqlite3_bind_parameter_count(s))
	var nn []string
	for i := 0; i < nv; i++ {
		pn := C.GoString(C.sqlite3_bind_parameter_name(s, C.int(i+1)))
		if len(pn) > 1 && pn[0] == '$' && 48 <= pn[1] && pn[1] <= 57 {
			nn = append(nn, C.GoString(C.sqlite3_bind_parameter_name(s, C.int(i+1))))
		}
	}
	ss := &SQLiteStmt{c: c, s: s, nv: nv, nn: nn, t: t}
	runtime.SetFinalizer(ss, (*SQLiteStmt).Close)
	return ss, nil
}

// Close the statement.
func (s *SQLiteStmt) Close() error {
	if s.closed {
		return nil
	}
	s.closed = true
	if s.c == nil || s.c.db == nil {
		return errors.New("sqlite statement with already closed database connection")
	}
	rv := C.sqlite3_finalize(s.s)
	if rv != C.SQLITE_OK {
		return s.c.lastError()
	}
	runtime.SetFinalizer(s, nil)
	return nil
}

// Return a number of parameters.
func (s *SQLiteStmt) NumInput() int {
	return s.nv
}

type bindArg struct {
	n int
	v driver.Value
}

func (s *SQLiteStmt) bind(args []driver.Value) error {
	rv := C.sqlite3_reset(s.s)
	if rv != C.SQLITE_ROW && rv != C.SQLITE_OK && rv != C.SQLITE_DONE {
		return s.c.lastError()
	}

	var vargs []bindArg
	narg := len(args)
	vargs = make([]bindArg, narg)
	if len(s.nn) > 0 {
		for i, v := range s.nn {
			if pi, err := strconv.Atoi(v[1:]); err == nil {
				vargs[i] = bindArg{pi, args[i]}
			}
		}
	} else {
		for i, v := range args {
			vargs[i] = bindArg{i + 1, v}
		}
	}

	for _, varg := range vargs {
		n := C.int(varg.n)
		v := varg.v
		switch v := v.(type) {
		case nil:
			rv = C.sqlite3_bind_null(s.s, n)
		case string:
			if len(v) == 0 {
				b := []byte{0}
				rv = C._sqlite3_bind_text(s.s, n, (*C.char)(unsafe.Pointer(&b[0])), C.int(0))
			} else {
				b := []byte(v)
				rv = C._sqlite3_bind_text(s.s, n, (*C.char)(unsafe.Pointer(&b[0])), C.int(len(b)))
			}
		case int64:
			rv = C.sqlite3_bind_int64(s.s, n, C.sqlite3_int64(v))
		case bool:
			if bool(v) {
				rv = C.sqlite3_bind_int(s.s, n, 1)
			} else {
				rv = C.sqlite3_bind_int(s.s, n, 0)
			}
		case float64:
			rv = C.sqlite3_bind_double(s.s, n, C.double(v))
		case []byte:
			var p *byte
			if len(v) > 0 {
				p = &v[0]
			}
			rv = C._sqlite3_bind_blob(s.s, n, unsafe.Pointer(p), C.int(len(v)))
		case time.Time:
			b := []byte(v.UTC().Format(SQLiteTimestampFormats[0]))
			rv = C._sqlite3_bind_text(s.s, n, (*C.char)(unsafe.Pointer(&b[0])), C.int(len(b)))
		}
		if rv != C.SQLITE_OK {
			return s.c.lastError()
		}
	}
	return nil
}

// Query the statement with arguments. Return records.
func (s *SQLiteStmt) Query(args []driver.Value) (driver.Rows, error) {
	if err := s.bind(args); err != nil {
		return nil, err
	}
	return &SQLiteRows{s, int(C.sqlite3_column_count(s.s)), nil, nil, s.cls}, nil
}

// Return last inserted ID.
func (r *SQLiteResult) LastInsertId() (int64, error) {
	return r.id, nil
}

// Return how many rows affected.
func (r *SQLiteResult) RowsAffected() (int64, error) {
	return r.changes, nil
}

// Execute the statement with arguments. Return result object.
func (s *SQLiteStmt) Exec(args []driver.Value) (driver.Result, error) {
	if err := s.bind(args); err != nil {
		C.sqlite3_reset(s.s)
		C.sqlite3_clear_bindings(s.s)
		return nil, err
	}
	var rowid, changes C.long
	rv := C._sqlite3_step(s.s, &rowid, &changes)
	if rv != C.SQLITE_ROW && rv != C.SQLITE_OK && rv != C.SQLITE_DONE {
		err := s.c.lastError()
		C.sqlite3_reset(s.s)
		C.sqlite3_clear_bindings(s.s)
		return nil, err
	}
	return &SQLiteResult{int64(rowid), int64(changes)}, nil
}

// Close the rows.
func (rc *SQLiteRows) Close() error {
	if rc.s.closed {
		return nil
	}
	if rc.cls {
		return rc.s.Close()
	}
	rv := C.sqlite3_reset(rc.s.s)
	if rv != C.SQLITE_OK {
		return rc.s.c.lastError()
	}
	return nil
}

// Return column names.
func (rc *SQLiteRows) Columns() []string {
	if rc.nc != len(rc.cols) {
		rc.cols = make([]string, rc.nc)
		for i := 0; i < rc.nc; i++ {
			rc.cols[i] = C.GoString(C.sqlite3_column_name(rc.s.s, C.int(i)))
		}
	}
	return rc.cols
}

// Move cursor to next.
func (rc *SQLiteRows) Next(dest []driver.Value) error {
	rv := C.sqlite3_step(rc.s.s)
	if rv == C.SQLITE_DONE {
		return io.EOF
	}
	if rv != C.SQLITE_ROW {
		rv = C.sqlite3_reset(rc.s.s)
		if rv != C.SQLITE_OK {
			return rc.s.c.lastError()
		}
		return nil
	}

	if rc.decltype == nil {
		rc.decltype = make([]string, rc.nc)
		for i := 0; i < rc.nc; i++ {
			rc.decltype[i] = strings.ToLower(C.GoString(C.sqlite3_column_decltype(rc.s.s, C.int(i))))
		}
	}

	for i := range dest {
		switch C.sqlite3_column_type(rc.s.s, C.int(i)) {
		case C.SQLITE_INTEGER:
			val := int64(C.sqlite3_column_int64(rc.s.s, C.int(i)))
			switch rc.decltype[i] {
			case "timestamp", "datetime", "date":
				unixTimestamp := strconv.FormatInt(val, 10)
				var t time.Time
				if len(unixTimestamp) == 13 {
					duration, err := time.ParseDuration(unixTimestamp + "ms")
					if err != nil {
						return fmt.Errorf("error parsing %s value %d, %s", rc.decltype[i], val, err)
					}
					epoch := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
					t = epoch.Add(duration)
				} else {
					t = time.Unix(val, 0)
				}
				if rc.s.c.loc != nil {
					t = t.In(rc.s.c.loc)
				}
				dest[i] = t
			case "boolean":
				dest[i] = val > 0
			default:
				dest[i] = val
			}
		case C.SQLITE_FLOAT:
			dest[i] = float64(C.sqlite3_column_double(rc.s.s, C.int(i)))
		case C.SQLITE_BLOB:
			p := C.sqlite3_column_blob(rc.s.s, C.int(i))
			if p == nil {
				dest[i] = nil
				continue
			}
			n := int(C.sqlite3_column_bytes(rc.s.s, C.int(i)))
			switch dest[i].(type) {
			case sql.RawBytes:
				dest[i] = (*[1 << 30]byte)(unsafe.Pointer(p))[0:n]
			default:
				slice := make([]byte, n)
				copy(slice[:], (*[1 << 30]byte)(unsafe.Pointer(p))[0:n])
				dest[i] = slice
			}
		case C.SQLITE_NULL:
			dest[i] = nil
		case C.SQLITE_TEXT:
			var err error
			var timeVal time.Time
			s := C.GoString((*C.char)(unsafe.Pointer(C.sqlite3_column_text(rc.s.s, C.int(i)))))

			switch rc.decltype[i] {
			case "timestamp", "datetime", "date":
				var t time.Time
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
				dest[i] = []byte(s)
			}

		}
	}
	return nil
}
