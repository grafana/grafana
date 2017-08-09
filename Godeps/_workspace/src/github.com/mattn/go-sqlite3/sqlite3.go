// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

/*
#cgo CFLAGS: -std=gnu99
#cgo CFLAGS: -DSQLITE_ENABLE_RTREE -DSQLITE_THREADSAFE
#cgo CFLAGS: -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS -DSQLITE_ENABLE_FTS4_UNICODE61
#ifndef USE_LIBSQLITE3
#include <sqlite3-binding.h>
#else
#include <sqlite3.h>
#endif
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

#ifndef SQLITE_DETERMINISTIC
# define SQLITE_DETERMINISTIC 0
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
_sqlite3_exec(sqlite3* db, const char* pcmd, long long* rowid, long long* changes)
{
  int rv = sqlite3_exec(db, pcmd, 0, 0, 0);
  *rowid = (long long) sqlite3_last_insert_rowid(db);
  *changes = (long long) sqlite3_changes(db);
  return rv;
}

static int
_sqlite3_step(sqlite3_stmt* stmt, long long* rowid, long long* changes)
{
  int rv = sqlite3_step(stmt);
  sqlite3* db = sqlite3_db_handle(stmt);
  *rowid = (long long) sqlite3_last_insert_rowid(db);
  *changes = (long long) sqlite3_changes(db);
  return rv;
}

void _sqlite3_result_text(sqlite3_context* ctx, const char* s) {
  sqlite3_result_text(ctx, s, -1, &free);
}

void _sqlite3_result_blob(sqlite3_context* ctx, const void* b, int l) {
  sqlite3_result_blob(ctx, b, l, SQLITE_TRANSIENT);
}


int _sqlite3_create_function(
  sqlite3 *db,
  const char *zFunctionName,
  int nArg,
  int eTextRep,
  uintptr_t pApp,
  void (*xFunc)(sqlite3_context*,int,sqlite3_value**),
  void (*xStep)(sqlite3_context*,int,sqlite3_value**),
  void (*xFinal)(sqlite3_context*)
) {
  return sqlite3_create_function(db, zFunctionName, nArg, eTextRep, (void*) pApp, xFunc, xStep, xFinal);
}

void callbackTrampoline(sqlite3_context*, int, sqlite3_value**);
void stepTrampoline(sqlite3_context*, int, sqlite3_value**);
void doneTrampoline(sqlite3_context*);
*/
import "C"
import (
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
	"time"
	"unsafe"
)

// Timestamp formats understood by both this module and SQLite.
// The first format in the slice will be used when saving time values
// into the database. When parsing a string from a timestamp or
// datetime column, the formats are tried in order.
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

func init() {
	sql.Register("sqlite3", &SQLiteDriver{})
}

// Version returns SQLite library version information.
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
	db          *C.sqlite3
	loc         *time.Location
	txlock      string
	funcs       []*functionInfo
	aggregators []*aggInfo
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

type functionInfo struct {
	f                 reflect.Value
	argConverters     []callbackArgConverter
	variadicConverter callbackArgConverter
	retConverter      callbackRetConverter
}

func (fi *functionInfo) Call(ctx *C.sqlite3_context, argv []*C.sqlite3_value) {
	args, err := callbackConvertArgs(argv, fi.argConverters, fi.variadicConverter)
	if err != nil {
		callbackError(ctx, err)
		return
	}

	ret := fi.f.Call(args)

	if len(ret) == 2 && ret[1].Interface() != nil {
		callbackError(ctx, ret[1].Interface().(error))
		return
	}

	err = fi.retConverter(ctx, ret[0])
	if err != nil {
		callbackError(ctx, err)
		return
	}
}

type aggInfo struct {
	constructor reflect.Value

	// Active aggregator objects for aggregations in flight. The
	// aggregators are indexed by a counter stored in the aggregation
	// user data space provided by sqlite.
	active map[int64]reflect.Value
	next   int64

	stepArgConverters     []callbackArgConverter
	stepVariadicConverter callbackArgConverter

	doneRetConverter callbackRetConverter
}

func (ai *aggInfo) agg(ctx *C.sqlite3_context) (int64, reflect.Value, error) {
	aggIdx := (*int64)(C.sqlite3_aggregate_context(ctx, C.int(8)))
	if *aggIdx == 0 {
		*aggIdx = ai.next
		ret := ai.constructor.Call(nil)
		if len(ret) == 2 && ret[1].Interface() != nil {
			return 0, reflect.Value{}, ret[1].Interface().(error)
		}
		if ret[0].IsNil() {
			return 0, reflect.Value{}, errors.New("aggregator constructor returned nil state")
		}
		ai.next++
		ai.active[*aggIdx] = ret[0]
	}
	return *aggIdx, ai.active[*aggIdx], nil
}

func (ai *aggInfo) Step(ctx *C.sqlite3_context, argv []*C.sqlite3_value) {
	_, agg, err := ai.agg(ctx)
	if err != nil {
		callbackError(ctx, err)
		return
	}

	args, err := callbackConvertArgs(argv, ai.stepArgConverters, ai.stepVariadicConverter)
	if err != nil {
		callbackError(ctx, err)
		return
	}

	ret := agg.MethodByName("Step").Call(args)
	if len(ret) == 1 && ret[0].Interface() != nil {
		callbackError(ctx, ret[0].Interface().(error))
		return
	}
}

func (ai *aggInfo) Done(ctx *C.sqlite3_context) {
	idx, agg, err := ai.agg(ctx)
	if err != nil {
		callbackError(ctx, err)
		return
	}
	defer func() { delete(ai.active, idx) }()

	ret := agg.MethodByName("Done").Call(nil)
	if len(ret) == 2 && ret[1].Interface() != nil {
		callbackError(ctx, ret[1].Interface().(error))
		return
	}

	err = ai.doneRetConverter(ctx, ret[0])
	if err != nil {
		callbackError(ctx, err)
		return
	}
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

// RegisterFunc makes a Go function available as a SQLite function.
//
// The Go function can have arguments of the following types: any
// numeric type except complex, bool, []byte, string and
// interface{}. interface{} arguments are given the direct translation
// of the SQLite data type: int64 for INTEGER, float64 for FLOAT,
// []byte for BLOB, string for TEXT.
//
// The function can additionally be variadic, as long as the type of
// the variadic argument is one of the above.
//
// If pure is true. SQLite will assume that the function's return
// value depends only on its inputs, and make more aggressive
// optimizations in its queries.
//
// See _example/go_custom_funcs for a detailed example.
func (c *SQLiteConn) RegisterFunc(name string, impl interface{}, pure bool) error {
	var fi functionInfo
	fi.f = reflect.ValueOf(impl)
	t := fi.f.Type()
	if t.Kind() != reflect.Func {
		return errors.New("Non-function passed to RegisterFunc")
	}
	if t.NumOut() != 1 && t.NumOut() != 2 {
		return errors.New("SQLite functions must return 1 or 2 values")
	}
	if t.NumOut() == 2 && !t.Out(1).Implements(reflect.TypeOf((*error)(nil)).Elem()) {
		return errors.New("Second return value of SQLite function must be error")
	}

	numArgs := t.NumIn()
	if t.IsVariadic() {
		numArgs--
	}

	for i := 0; i < numArgs; i++ {
		conv, err := callbackArg(t.In(i))
		if err != nil {
			return err
		}
		fi.argConverters = append(fi.argConverters, conv)
	}

	if t.IsVariadic() {
		conv, err := callbackArg(t.In(numArgs).Elem())
		if err != nil {
			return err
		}
		fi.variadicConverter = conv
		// Pass -1 to sqlite so that it allows any number of
		// arguments. The call helper verifies that the minimum number
		// of arguments is present for variadic functions.
		numArgs = -1
	}

	conv, err := callbackRet(t.Out(0))
	if err != nil {
		return err
	}
	fi.retConverter = conv

	// fi must outlast the database connection, or we'll have dangling pointers.
	c.funcs = append(c.funcs, &fi)

	cname := C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	opts := C.SQLITE_UTF8
	if pure {
		opts |= C.SQLITE_DETERMINISTIC
	}
	rv := C._sqlite3_create_function(c.db, cname, C.int(numArgs), C.int(opts), C.uintptr_t(newHandle(c, &fi)), (*[0]byte)(unsafe.Pointer(C.callbackTrampoline)), nil, nil)
	if rv != C.SQLITE_OK {
		return c.lastError()
	}
	return nil
}

// RegisterAggregator makes a Go type available as a SQLite aggregation function.
//
// Because aggregation is incremental, it's implemented in Go with a
// type that has 2 methods: func Step(values) accumulates one row of
// data into the accumulator, and func Done() ret finalizes and
// returns the aggregate value. "values" and "ret" may be any type
// supported by RegisterFunc.
//
// RegisterAggregator takes as implementation a constructor function
// that constructs an instance of the aggregator type each time an
// aggregation begins. The constructor must return a pointer to a
// type, or an interface that implements Step() and Done().
//
// The constructor function and the Step/Done methods may optionally
// return an error in addition to their other return values.
//
// See _example/go_custom_funcs for a detailed example.
func (c *SQLiteConn) RegisterAggregator(name string, impl interface{}, pure bool) error {
	var ai aggInfo
	ai.constructor = reflect.ValueOf(impl)
	t := ai.constructor.Type()
	if t.Kind() != reflect.Func {
		return errors.New("non-function passed to RegisterAggregator")
	}
	if t.NumOut() != 1 && t.NumOut() != 2 {
		return errors.New("SQLite aggregator constructors must return 1 or 2 values")
	}
	if t.NumOut() == 2 && !t.Out(1).Implements(reflect.TypeOf((*error)(nil)).Elem()) {
		return errors.New("Second return value of SQLite function must be error")
	}
	if t.NumIn() != 0 {
		return errors.New("SQLite aggregator constructors must not have arguments")
	}

	agg := t.Out(0)
	switch agg.Kind() {
	case reflect.Ptr, reflect.Interface:
	default:
		return errors.New("SQlite aggregator constructor must return a pointer object")
	}
	stepFn, found := agg.MethodByName("Step")
	if !found {
		return errors.New("SQlite aggregator doesn't have a Step() function")
	}
	step := stepFn.Type
	if step.NumOut() != 0 && step.NumOut() != 1 {
		return errors.New("SQlite aggregator Step() function must return 0 or 1 values")
	}
	if step.NumOut() == 1 && !step.Out(0).Implements(reflect.TypeOf((*error)(nil)).Elem()) {
		return errors.New("type of SQlite aggregator Step() return value must be error")
	}

	stepNArgs := step.NumIn()
	start := 0
	if agg.Kind() == reflect.Ptr {
		// Skip over the method receiver
		stepNArgs--
		start++
	}
	if step.IsVariadic() {
		stepNArgs--
	}
	for i := start; i < start+stepNArgs; i++ {
		conv, err := callbackArg(step.In(i))
		if err != nil {
			return err
		}
		ai.stepArgConverters = append(ai.stepArgConverters, conv)
	}
	if step.IsVariadic() {
		conv, err := callbackArg(t.In(start + stepNArgs).Elem())
		if err != nil {
			return err
		}
		ai.stepVariadicConverter = conv
		// Pass -1 to sqlite so that it allows any number of
		// arguments. The call helper verifies that the minimum number
		// of arguments is present for variadic functions.
		stepNArgs = -1
	}

	doneFn, found := agg.MethodByName("Done")
	if !found {
		return errors.New("SQlite aggregator doesn't have a Done() function")
	}
	done := doneFn.Type
	doneNArgs := done.NumIn()
	if agg.Kind() == reflect.Ptr {
		// Skip over the method receiver
		doneNArgs--
	}
	if doneNArgs != 0 {
		return errors.New("SQlite aggregator Done() function must have no arguments")
	}
	if done.NumOut() != 1 && done.NumOut() != 2 {
		return errors.New("SQLite aggregator Done() function must return 1 or 2 values")
	}
	if done.NumOut() == 2 && !done.Out(1).Implements(reflect.TypeOf((*error)(nil)).Elem()) {
		return errors.New("second return value of SQLite aggregator Done() function must be error")
	}

	conv, err := callbackRet(done.Out(0))
	if err != nil {
		return err
	}
	ai.doneRetConverter = conv
	ai.active = make(map[int64]reflect.Value)
	ai.next = 1

	// ai must outlast the database connection, or we'll have dangling pointers.
	c.aggregators = append(c.aggregators, &ai)

	cname := C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	opts := C.SQLITE_UTF8
	if pure {
		opts |= C.SQLITE_DETERMINISTIC
	}
	rv := C._sqlite3_create_function(c.db, cname, C.int(stepNArgs), C.int(opts), C.uintptr_t(newHandle(c, &ai)), nil, (*[0]byte)(unsafe.Pointer(C.stepTrampoline)), (*[0]byte)(unsafe.Pointer(C.doneTrampoline)))
	if rv != C.SQLITE_OK {
		return c.lastError()
	}
	return nil
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

	var rowid, changes C.longlong
	rv := C._sqlite3_exec(c.db, pcmd, &rowid, &changes)
	if rv != C.SQLITE_OK {
		return nil, c.lastError()
	}
	return &SQLiteResult{int64(rowid), int64(changes)}, nil
}

// Begin transaction.
func (c *SQLiteConn) Begin() (driver.Tx, error) {
	if _, err := c.exec(c.txlock); err != nil {
		return nil, err
	}
	return &SQLiteTx{c}, nil
}

func errorString(err Error) string {
	return C.GoString(C.sqlite3_errstr(C.int(err.Code)))
}

// Open database and return a new connection.
// You can specify a DSN string using a URI as the filename.
//   test.db
//   file:test.db?cache=shared&mode=memory
//   :memory:
//   file::memory:
// go-sqlite3 adds the following query parameters to those used by SQLite:
//   _loc=XXX
//     Specify location of time format. It's possible to specify "auto".
//   _busy_timeout=XXX
//     Specify value for sqlite3_busy_timeout.
//   _txlock=XXX
//     Specify locking behavior for transactions.  XXX can be "immediate",
//     "deferred", "exclusive".
func (d *SQLiteDriver) Open(dsn string) (driver.Conn, error) {
	if C.sqlite3_threadsafe() == 0 {
		return nil, errors.New("sqlite library was not compiled for thread-safe operation")
	}

	var loc *time.Location
	txlock := "BEGIN"
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

		// _txlock
		if val := params.Get("_txlock"); val != "" {
			switch val {
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

	conn := &SQLiteConn{db: db, loc: loc, txlock: txlock}

	if len(d.Extensions) > 0 {
		if err := conn.loadExtensions(d.Extensions); err != nil {
			return nil, err
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
	deleteHandles(c)
	rv := C.sqlite3_close_v2(c.db)
	if rv != C.SQLITE_OK {
		return c.lastError()
	}
	c.db = nil
	runtime.SetFinalizer(c, nil)
	return nil
}

// Prepare the query string. Return a new statement.
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
			if len(v) == 0 {
				rv = C._sqlite3_bind_blob(s.s, n, nil, 0)
			} else {
				rv = C._sqlite3_bind_blob(s.s, n, unsafe.Pointer(&v[0]), C.int(len(v)))
			}
		case time.Time:
			b := []byte(v.Format(SQLiteTimestampFormats[0]))
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
	var rowid, changes C.longlong
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

// Return column types.
func (rc *SQLiteRows) DeclTypes() []string {
	if rc.decltype == nil {
		rc.decltype = make([]string, rc.nc)
		for i := 0; i < rc.nc; i++ {
			rc.decltype[i] = strings.ToLower(C.GoString(C.sqlite3_column_decltype(rc.s.s, C.int(i))))
		}
	}
	return rc.decltype
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

	rc.DeclTypes()

	for i := range dest {
		switch C.sqlite3_column_type(rc.s.s, C.int(i)) {
		case C.SQLITE_INTEGER:
			val := int64(C.sqlite3_column_int64(rc.s.s, C.int(i)))
			switch rc.decltype[i] {
			case "timestamp", "datetime", "date":
				var t time.Time
				// Assume a millisecond unix timestamp if it's 13 digits -- too
				// large to be a reasonable timestamp in seconds.
				if val > 1e12 || val < -1e12 {
					val *= int64(time.Millisecond) // convert ms to nsec
				} else {
					val *= int64(time.Second) // convert sec to nsec
				}
				t = time.Unix(0, val).UTC()
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

			n := int(C.sqlite3_column_bytes(rc.s.s, C.int(i)))
			s := C.GoStringN((*C.char)(unsafe.Pointer(C.sqlite3_column_text(rc.s.s, C.int(i)))), C.int(n))

			switch rc.decltype[i] {
			case "timestamp", "datetime", "date":
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
				dest[i] = []byte(s)
			}

		}
	}
	return nil
}
