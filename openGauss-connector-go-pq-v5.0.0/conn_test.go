package pq

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"fmt"
	"github.com/stretchr/testify/assert"
	"io"
	"net"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

type Fatalistic interface {
	Fatal(args ...interface{})
}

func forceBinaryParameters() bool {
	bp := os.Getenv("PQTEST_BINARY_PARAMETERS")
	if bp == "yes" {
		return true
	} else if bp == "" || bp == "no" {
		return false
	} else {
		panic("unexpected value for PQTEST_BINARY_PARAMETERS")
	}
}

func testConninfo(conninfo string) string {
	// defaultTo := func(envvar string, value string) {
	// 	if os.Getenv(envvar) == "" {
	// 		os.Setenv(envvar, value)
	// 	}
	// }
	// defaultTo("PGDATABASE", "pqgotest")
	// defaultTo("PGSSLMODE", "disable")
	// defaultTo("PGCONNECT_TIMEOUT", "20")

	if forceBinaryParameters() &&
		!strings.HasPrefix(conninfo, "postgres://") &&
		!strings.HasPrefix(conninfo, "postgresql://") {
		conninfo += " binary_parameters=yes"
	}
	return conninfo
}

func openTestConnConfig(config *Config) (*sql.DB, error) {
	connector, err := NewConnectorConfig(config)
	if err != nil {
		return nil, err
	}
	return sql.OpenDB(connector), nil
}

func openTestConnConninfo(connInfo string) (*sql.DB, error) {
	return sql.Open("opengauss", testConninfo(connInfo))
}

func getTestDsn() (string, error) {
	dsn := os.Getenv("TEST_CONN_STRING")
	if dsn == "" {
		return "", fmt.Errorf("not define TEST_CONN_STRING env")
	}
	return dsn, nil
}
func genTestConfig() (*Config, error) {
	dsn := os.Getenv("TEST_CONN_STRING")
	if dsn == "" {
		return nil, fmt.Errorf("not define TEST_CONN_STRING env")
	}
	return ParseConfig(dsn)
}

func openTestConn(t Fatalistic) *sql.DB {
	dsn, err := getTestDsn()
	if err != nil {
		t.Fatal(err)
	}
	conn, err := openTestConnConninfo(dsn)
	if err != nil {
		t.Fatal(err)
	}

	return conn
}

func getServerVersion(t *testing.T, db *sql.DB) int {
	var version int
	err := db.QueryRow("SHOW server_version_num").Scan(&version)
	if err != nil {
		t.Fatal(err)
	}
	return version
}

func TestReconnect(t *testing.T) {
	db1 := openTestConn(t)
	defer db1.Close()
	tx, err := db1.Begin()
	if err != nil {
		t.Fatal(err)
	}
	var pid1 int
	err = tx.QueryRow("SELECT pg_backend_pid()").Scan(&pid1)
	if err != nil {
		t.Fatal(err)
	}
	db2 := openTestConn(t)
	defer db2.Close()
	_, err = db2.Exec("SELECT pg_terminate_backend($1)", pid1)
	if err != nil {
		t.Fatal(err)
	}
	// The rollback will probably "fail" because we just killed
	// its connection above
	_ = tx.Rollback()

	const expected int = 42
	var result int
	err = db1.QueryRow(fmt.Sprintf("SELECT %d", expected)).Scan(&result)
	if err != nil {
		t.Fatal(err)
	}
	if result != expected {
		t.Errorf("got %v; expected %v", result, expected)
	}
}

func TestCommitInFailedTransaction(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	rows, err := txn.Query("SELECT error")
	if err == nil {
		rows.Close()
		t.Fatal("expected failure")
	}
	err = txn.Commit()
	if err != ErrInFailedTransaction {
		t.Fatalf("expected ErrInFailedTransaction; got %#v", err)
	}
}

func TestExec(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Exec("CREATE TEMP TABLE temp (a int)")
	if err != nil {
		t.Fatal(err)
	}

	r, err := db.Exec("INSERT INTO temp VALUES (1)")
	if err != nil {
		t.Fatal(err)
	}

	if n, _ := r.RowsAffected(); n != 1 {
		t.Fatalf("expected 1 row affected, not %d", n)
	}

	r, err = db.Exec("INSERT INTO temp VALUES ($1), ($2), ($3)", 1, 2, 3)
	if err != nil {
		t.Fatal(err)
	}

	if n, _ := r.RowsAffected(); n != 3 {
		t.Fatalf("expected 3 rows affected, not %d", n)
	}

	// SELECT doesn't send the number of returned rows in the command tag
	// before 9.0
	if getServerVersion(t, db) >= 90000 {
		r, err = db.Exec("SELECT g FROM generate_series(1, 2) g")
		if err != nil {
			t.Fatal(err)
		}
		if n, _ := r.RowsAffected(); n != 2 {
			t.Fatalf("expected 2 rows affected, not %d", n)
		}

		r, err = db.Exec("SELECT g FROM generate_series(1, $1) g", 3)
		if err != nil {
			t.Fatal(err)
		}
		if n, _ := r.RowsAffected(); n != 3 {
			t.Fatalf("expected 3 rows affected, not %d", n)
		}
	}
}

func TestStatment(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	st, err := db.Prepare("SELECT 1")
	if err != nil {
		t.Fatal(err)
	}

	st1, err := db.Prepare("SELECT 2")
	if err != nil {
		t.Fatal(err)
	}

	r, err := st.Query()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	if !r.Next() {
		t.Fatal("expected row")
	}

	var i int
	err = r.Scan(&i)
	if err != nil {
		t.Fatal(err)
	}

	if i != 1 {
		t.Fatalf("expected 1, got %d", i)
	}

	// st1

	r1, err := st1.Query()
	if err != nil {
		t.Fatal(err)
	}
	defer r1.Close()

	if !r1.Next() {
		if r.Err() != nil {
			t.Fatal(r1.Err())
		}
		t.Fatal("expected row")
	}

	err = r1.Scan(&i)
	if err != nil {
		t.Fatal(err)
	}

	if i != 2 {
		t.Fatalf("expected 2, got %d", i)
	}
}

func TestRowsCloseBeforeDone(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	r, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatal(err)
	}

	err = r.Close()
	if err != nil {
		t.Fatal(err)
	}

	if r.Next() {
		t.Fatal("unexpected row")
	}

	if r.Err() != nil {
		t.Fatal(r.Err())
	}
}

func TestParameterCountMismatch(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	var notused int
	err := db.QueryRow("SELECT false", 1).Scan(&notused)
	if err == nil {
		t.Fatal("expected err")
	}
	// make sure we clean up correctly
	err = db.QueryRow("SELECT 1").Scan(&notused)
	if err != nil {
		t.Fatal(err)
	}

	err = db.QueryRow("SELECT $1").Scan(&notused)
	if err == nil {
		t.Fatal("expected err")
	}
	// make sure we clean up correctly
	err = db.QueryRow("SELECT 1").Scan(&notused)
	if err != nil {
		t.Fatal(err)
	}
}

// Test that EmptyQueryResponses are handled correctly.
func TestEmptyQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	res, err := db.Exec("")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := res.RowsAffected(); err != errNoRowsAffected {
		t.Fatalf("expected %s, got %v", errNoRowsAffected, err)
	}
	if _, err := res.LastInsertId(); err != errNoLastInsertID {
		t.Fatalf("expected %s, got %v", errNoLastInsertID, err)
	}
	rows, err := db.Query("")
	if err != nil {
		t.Fatal(err)
	}
	cols, err := rows.Columns()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 0 {
		t.Fatalf("unexpected number of columns %d in response to an empty query", len(cols))
	}
	if rows.Next() {
		t.Fatal("unexpected row")
	}
	if rows.Err() != nil {
		t.Fatal(rows.Err())
	}

	stmt, err := db.Prepare("")
	if err != nil {
		t.Fatal(err)
	}
	res, err = stmt.Exec()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := res.RowsAffected(); err != errNoRowsAffected {
		t.Fatalf("expected %s, got %v", errNoRowsAffected, err)
	}
	if _, err := res.LastInsertId(); err != errNoLastInsertID {
		t.Fatalf("expected %s, got %v", errNoLastInsertID, err)
	}
	rows, err = stmt.Query()
	if err != nil {
		t.Fatal(err)
	}
	cols, err = rows.Columns()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 0 {
		t.Fatalf("unexpected number of columns %d in response to an empty query", len(cols))
	}
	if rows.Next() {
		t.Fatal("unexpected row")
	}
	if rows.Err() != nil {
		t.Fatal(rows.Err())
	}
}

// Test that rows.Columns() is correct even if there are no result rows.
func TestEmptyResultSetColumns(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	rows, err := db.Query("SELECT 1 AS a, text 'bar' AS bar WHERE FALSE")
	if err != nil {
		t.Fatal(err)
	}
	cols, err := rows.Columns()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 2 {
		t.Fatalf("unexpected number of columns %d in response to an empty query", len(cols))
	}
	if rows.Next() {
		t.Fatal("unexpected row")
	}
	if rows.Err() != nil {
		t.Fatal(rows.Err())
	}
	if cols[0] != "a" || cols[1] != "bar" {
		t.Fatalf("unexpected Columns result %v", cols)
	}

	stmt, err := db.Prepare("SELECT $1::int AS a, text 'bar' AS bar WHERE FALSE")
	if err != nil {
		t.Fatal(err)
	}
	rows, err = stmt.Query(1)
	if err != nil {
		t.Fatal(err)
	}
	cols, err = rows.Columns()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 2 {
		t.Fatalf("unexpected number of columns %d in response to an empty query", len(cols))
	}
	if rows.Next() {
		t.Fatal("unexpected row")
	}
	if rows.Err() != nil {
		t.Fatal(rows.Err())
	}
	if cols[0] != "a" || cols[1] != "bar" {
		t.Fatalf("unexpected Columns result %v", cols)
	}

}

func TestEncodeDecode(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	q := `
		SELECT
			E'\\000\\001\\002'::bytea,
			'foobar'::text,
			NULL::integer,
			'2000-1-1 01:02:03.04-7'::timestamptz,
			0::boolean,
			123,
			-321,
			3.14::float8
		WHERE
			    E'\\000\\001\\002'::bytea = $1
			AND 'foobar'::text = $2
			AND $3::integer is NULL
	`
	// AND '2000-1-1 12:00:00.000000-7'::timestamp = $3

	exp1 := []byte{0, 1, 2}
	exp2 := "foobar"

	r, err := db.Query(q, exp1, exp2, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	if !r.Next() {
		if r.Err() != nil {
			t.Fatal(r.Err())
		}
		t.Fatal("expected row")
	}

	var got1 []byte
	var got2 string
	var got3 = sql.NullInt64{Valid: true}
	var got4 time.Time
	var got5, got6, got7, got8 interface{}

	err = r.Scan(&got1, &got2, &got3, &got4, &got5, &got6, &got7, &got8)
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(exp1, got1) {
		t.Errorf("expected %q byte: %q", exp1, got1)
	}

	if !reflect.DeepEqual(exp2, got2) {
		t.Errorf("expected %q byte: %q", exp2, got2)
	}

	if got3.Valid {
		t.Fatal("expected invalid")
	}

	if got4.Year() != 2000 {
		t.Fatal("wrong year")
	}

	if got5 != false {
		t.Fatalf("expected false, got %q", got5)
	}

	if got6 != int64(123) {
		t.Fatalf("expected 123, got %d", got6)
	}

	if got7 != int64(-321) {
		t.Fatalf("expected -321, got %d", got7)
	}

	if got8 != float64(3.14) {
		t.Fatalf("expected 3.14, got %f", got8)
	}
}

func TestNoData(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	st, err := db.Prepare("SELECT 1 WHERE true = false")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()

	r, err := st.Query()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	if r.Next() {
		if r.Err() != nil {
			t.Fatal(r.Err())
		}
		t.Fatal("unexpected row")
	}

	_, err = db.Query("SELECT * FROM nonexistenttable WHERE age=$1", 20)
	if err == nil {
		t.Fatal("Should have raised an error on non existent table")
	}

	_, err = db.Query("SELECT * FROM nonexistenttable")
	if err == nil {
		t.Fatal("Should have raised an error on non existent table")
	}
}

func TestErrorDuringStartup(t *testing.T) {
	// Don't use the normal connection setup, this is intended to
	// blow up in the startup packet from a non-existent user.
	config, err := genTestConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.User = "thisuserreallydoesntexist"
	db, err := openTestConnConfig(config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, err = db.Begin()
	if err == nil {
		t.Fatal("expected error")
	}
	e, ok := err.(*connectError)
	if !ok {
		t.Fatalf("expected Error, got %#v", err)
		return
	}
	err = e.err

	e1, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected Error, got %#v", err)
		return
	}
	if e1.Code.Name() != "invalid_authorization_specification" && e1.Code.Name() != "invalid_password" {
		t.Fatalf("expected invalid_authorization_specification or invalid_password, got %s (%+v)", e1.Code.Name(), err)
	}
}

type testConn struct {
	closed bool
	net.Conn
}

func (c *testConn) Close() error {
	c.closed = true
	return c.Conn.Close()
}

type testDialer struct {
	conns []*testConn
}

func (d *testDialer) Dial(ntw, addr string) (net.Conn, error) {
	c, err := net.Dial(ntw, addr)
	if err != nil {
		return nil, err
	}
	tc := &testConn{Conn: c}
	d.conns = append(d.conns, tc)
	return tc, nil
}

func (d *testDialer) DialTimeout(ntw, addr string, timeout time.Duration) (net.Conn, error) {
	c, err := net.DialTimeout(ntw, addr, timeout)
	if err != nil {
		return nil, err
	}
	tc := &testConn{Conn: c}
	d.conns = append(d.conns, tc)
	return tc, nil
}

// func TestErrorDuringStartupClosesConn(t *testing.T) { // TODO
// 	// Don't use the normal connection setup, this is intended to
// 	// blow up in the startup packet from a non-existent user.
// 	var d testDialer
// 	c, err := DialOpen(&d, testConninfo("user=thisuserreallydoesntexist"))
// 	if err == nil {
// 		c.Close()
// 		t.Fatal("expected dial error")
// 	}
// 	if len(d.conns) != 1 {
// 		t.Fatalf("got len(d.conns) = %d, want = %d", len(d.conns), 1)
// 	}
// 	if !d.conns[0].closed {
// 		t.Error("connection leaked")
// 	}
// }

func TestBadConn(t *testing.T) {
	var err error

	cn := conn{}
	func() {
		defer cn.errRecover(&err)
		panic(io.EOF)
	}()
	if err != driver.ErrBadConn {
		t.Fatalf("expected driver.ErrBadConn, got: %#v", err)
	}
	if err := cn.err.get(); err != driver.ErrBadConn {
		t.Fatalf("expected driver.ErrBadConn, got %#v", err)
	}

	// cn = conn{}
	// func() {
	// 	defer cn.errRecover(&err)
	// 	e := &Error{Severity: Efatal}
	// 	panic(e)
	// }()
	// if err != driver.ErrBadConn {
	// 	t.Fatalf("expected driver.ErrBadConn, got: %#v", err)
	// }
	// if err := cn.err.get(); err != driver.ErrBadConn {
	// 	t.Fatalf("expected driver.ErrBadConn, got %#v", err)
	// }
}

// TestCloseBadConn tests that the underlying connection can be closed with
// Close after an error.
func TestCloseBadConn(t *testing.T) {
	config, err := genTestConfig()
	if err != nil {
		t.Error(err)
	}
	host := config.Host
	port := config.Port
	nc, err := net.Dial("tcp", fmt.Sprintf("%s:%v", host, port))
	if err != nil {
		t.Fatal(err)
	}
	cn := conn{c: nc}
	func() {
		defer cn.errRecover(&err)
		panic(io.EOF)
	}()
	// Verify we can write before closing.
	if _, err := nc.Write(nil); err != nil {
		t.Fatal(err)
	}
	// First close should close the connection.
	if err := cn.Close(); err != nil {
		t.Fatal(err)
	}

	// During the Go 1.9 cycle, https://github.com/golang/go/commit/3792db5
	// changed this error from
	//
	// net.errClosing = errors.New("use of closed network connection")
	//
	// to
	//
	// internal/poll.ErrClosing = errors.New("use of closed file or network connection")
	const errClosing = "use of closed"

	// Verify write after closing fails.
	if _, err := nc.Write(nil); err == nil {
		t.Fatal("expected error")
	} else if !strings.Contains(err.Error(), errClosing) {
		t.Fatalf("expected %s error, got %s", errClosing, err)
	}
	// Verify second close fails.
	if err := cn.Close(); err == nil {
		t.Fatal("expected error")
	} else if !strings.Contains(err.Error(), errClosing) {
		t.Fatalf("expected %s error, got %s", errClosing, err)
	}
}

func TestErrorOnExec(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer txn.Rollback()

	_, err = txn.Exec("CREATE TEMPORARY TABLE foo(f1 int PRIMARY KEY)")
	if err != nil {
		t.Fatal(err)
	}

	_, err = txn.Exec("INSERT INTO foo VALUES (0), (0)")
	if err == nil {
		t.Fatal("Should have raised error")
	}

	e, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected Error, got %#v", err)
	} else if e.Code.Name() != "unique_violation" {
		t.Fatalf("expected unique_violation, got %s (%+v)", e.Code.Name(), err)
	}
}

func TestErrorOnQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer txn.Rollback()

	_, err = txn.Exec("CREATE TEMPORARY TABLE foo(f1 int PRIMARY KEY)")
	if err != nil {
		t.Fatal(err)
	}

	_, err = txn.Query("INSERT INTO foo VALUES (0), (0)")
	if err == nil {
		t.Fatal("Should have raised error")
	}

	e, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected Error, got %#v", err)
	} else if e.Code.Name() != "unique_violation" {
		t.Fatalf("expected unique_violation, got %s (%+v)", e.Code.Name(), err)
	}
}

func TestErrorOnQueryRowSimpleQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer txn.Rollback()

	_, err = txn.Exec("CREATE TEMPORARY TABLE foo(f1 int PRIMARY KEY)")
	if err != nil {
		t.Fatal(err)
	}

	var v int
	err = txn.QueryRow("INSERT INTO foo VALUES (0), (0)").Scan(&v)
	if err == nil {
		t.Fatal("Should have raised error")
	}

	e, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected Error, got %#v", err)
	} else if e.Code.Name() != "unique_violation" {
		t.Fatalf("expected unique_violation, got %s (%+v)", e.Code.Name(), err)
	}
}

// Test the QueryRow bug workarounds in stmt.exec() and simpleQuery()
func TestQueryRowBugWorkaround(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	// stmt.exec()
	_, err := db.Exec("CREATE TEMP TABLE notnulltemp (a varchar(10) not null)")
	if err != nil {
		t.Fatal(err)
	}

	var a string
	err = db.QueryRow("INSERT INTO notnulltemp(a) values($1) RETURNING a", nil).Scan(&a)
	if err == sql.ErrNoRows {
		t.Fatalf("expected constraint violation error; got: %v", err)
	}
	pge, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *Error; got: %#v", err)
	}
	if pge.Code.Name() != "not_null_violation" {
		t.Fatalf("expected not_null_violation; got: %s (%+v)", pge.Code.Name(), err)
	}

	// Test workaround in simpleQuery()
	// 	tx, err := db.Begin()
	// 	if err != nil {
	// 		t.Fatalf("unexpected error %s in Begin", err)
	// 	}
	// 	defer tx.Rollback()
	//
	// 	_, err = tx.Exec("SET LOCAL check_function_bodies TO FALSE")
	// 	if err != nil {
	// 		t.Fatalf("could not disable check_function_bodies: %s", err)
	// 	}
	// 	_, err = tx.Exec(`
	// CREATE OR REPLACE FUNCTION bad_function()
	// RETURNS integer
	// -- hack to prevent the function from being inlined
	// SET check_function_bodies TO TRUE
	// AS $$
	// 	SELECT text 'bad'
	// $$ LANGUAGE sql`)
	// 	if err != nil {
	// 		t.Fatalf("could not create function: %s", err)
	// 	}
	//
	// 	err = tx.QueryRow("SELECT * FROM bad_function()").Scan(&a)
	// 	if err == nil {
	// 		t.Fatalf("expected error")
	// 	}
	// 	pge, ok = err.(*Error)
	// 	if !ok {
	// 		t.Fatalf("expected *Error; got: %#v", err)
	// 	}
	// 	if pge.Code.Name() != "invalid_function_definition" {
	// 		t.Fatalf("expected invalid_function_definition; got: %s (%+v)", pge.Code.Name(), err)
	// 	}
	//
	// 	err = tx.Rollback()
	// 	if err != nil {
	// 		t.Fatalf("unexpected error %s in Rollback", err)
	// 	}

	// Also test that simpleQuery()'s workaround works when the query fails
	// after a row has been received.
	rows, err := db.Query(
		`
select
	(select generate_series(1, ss.i))
from (select gs.i
      from generate_series(1, 2) gs(i)
      order by gs.i limit 2) ss`,
	)
	if err != nil {
		t.Fatalf("query failed: %s", err)
	}
	if !rows.Next() {
		t.Fatalf("expected at least one result row; got %s", rows.Err())
	}
	var i int
	err = rows.Scan(&i)
	if err != nil {
		t.Fatalf("rows.Scan() failed: %s", err)
	}
	if i != 1 {
		t.Fatalf("unexpected value for i: %d", i)
	}
	if rows.Next() {
		t.Fatalf("unexpected row")
	}
	pge, ok = rows.Err().(*Error)
	if !ok {
		t.Fatalf("expected *Error; got: %#v", err)
	}
	if pge.Code.Name() != "cardinality_violation" {
		t.Fatalf("expected cardinality_violation; got: %s (%+v)", pge.Code.Name(), rows.Err())
	}
}

func TestSimpleQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	r, err := db.Query("select 1")
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	if !r.Next() {
		t.Fatal("expected row")
	}
}

func TestBindError(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Exec("create temp table test (i integer)")
	if err != nil {
		t.Fatal(err)
	}

	_, err = db.Query("select * from test where i=$1", "hhh")
	if err == nil {
		t.Fatal("expected an error")
	}

	// Should not get error here
	r, err := db.Query("select * from test where i=$1", 1)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
}

func TestParseErrorInExtendedQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Query("PARSE_ERROR $1", 1)
	pqErr, _ := err.(*Error)
	// Expecting a syntax error.
	if err == nil || pqErr == nil || pqErr.Code != "42601" {
		t.Fatalf("expected syntax error, got %s", err)
	}

	rows, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatal(err)
	}
	rows.Close()
}

// TestReturning tests that an INSERT query using the RETURNING clause returns a row.
func TestReturning(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Exec("CREATE TEMP TABLE distributors (did integer default 0, dname text)")
	if err != nil {
		t.Fatal(err)
	}

	rows, err := db.Query(
		"INSERT INTO distributors (did, dname) VALUES (DEFAULT, 'XYZ Widgets') " +
			"RETURNING did;",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !rows.Next() {
		t.Fatal("no rows")
	}
	var did int
	err = rows.Scan(&did)
	if err != nil {
		t.Fatal(err)
	}
	if did != 0 {
		t.Fatalf("bad value for did: got %d, want %d", did, 0)
	}

	if rows.Next() {
		t.Fatal("unexpected next row")
	}
	err = rows.Err()
	if err != nil {
		t.Fatal(err)
	}
}

func TestIssue186(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	// Exec() a query which returns results
	_, err := db.Exec("VALUES (1), (2), (3)")
	if err != nil {
		t.Fatal(err)
	}

	_, err = db.Exec("VALUES ($1), ($2), ($3)", 1, 2, 3)
	if err != nil {
		t.Fatal(err)
	}

	// Query() a query which doesn't return any results
	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer txn.Rollback()

	rows, err := txn.Query("CREATE TEMP TABLE foo(f1 int)")
	if err != nil {
		t.Fatal(err)
	}
	if err = rows.Close(); err != nil {
		t.Fatal(err)
	}

	// small trick to get NoData from a parameterized query
	_, err = txn.Exec("CREATE RULE nodata AS ON INSERT TO foo DO INSTEAD NOTHING")
	if err != nil {
		t.Fatal(err)
	}
	rows, err = txn.Query("INSERT INTO foo VALUES ($1)", 1)
	if err != nil {
		t.Fatal(err)
	}
	if err = rows.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestIssue196(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	row := db.QueryRow(
		"SELECT float4 '0.10000122' = $1, float8 '35.03554004971999' = $2",
		float32(0.10000122), float64(35.03554004971999),
	)

	var float4match, float8match bool
	err := row.Scan(&float4match, &float8match)
	if err != nil {
		t.Fatal(err)
	}
	if !float4match {
		t.Errorf("Expected float4 fidelity to be maintained; got no match")
	}
	if !float8match {
		t.Errorf("Expected float8 fidelity to be maintained; got no match")
	}
}

// Test that any CommandComplete messages sent before the query results are
// ignored.
func TestIssue282(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	var searchPath string
	err := db.QueryRow(
		`
		SET LOCAL search_path TO pg_catalog;
		SET LOCAL search_path TO pg_catalog;
		SHOW search_path`,
	).Scan(&searchPath)
	if err != nil {
		t.Fatal(err)
	}
	if searchPath != "pg_catalog" {
		t.Fatalf("unexpected search_path %s", searchPath)
	}
}

/* TestReadFloatPrecision
omm=# SELECT float4 '0.10000122', float8 '35.03554004971999', float4 '1.2'
omm-# ;
 float4  |     float8     | float4
---------+----------------+--------
 .100001 | 35.03554004972 |    1.2
(1 row)
*/
func TestReadFloatPrecision(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	row := db.QueryRow("SELECT float4 '0.10000122', float8 '35.03554004971999', float4 '1.2'")
	var float4val float32
	var float8val float64
	var float4val2 float64
	err := row.Scan(&float4val, &float8val, &float4val2)
	if err != nil {
		t.Fatal(err)
	}
	if float4val != float32(0.100001) {
		t.Errorf("Expected float4 fidelity to be maintained; got no match")
	}
	if float8val != float64(35.03554004972) {
		t.Errorf("Expected float8 fidelity to be maintained; got no match")
	}
	if float4val2 != float64(1.2) {
		t.Errorf("Expected float4 fidelity into a float64 to be maintained; got no match")
	}
}

func TestXactMultiStmt(t *testing.T) {
	// minified test case based on bug reports from
	// pico303@gmail.com and rangelspam@gmail.com
	t.Skip("Skipping failing test")
	db := openTestConn(t)
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Commit()

	rows, err := tx.Query("select 1")
	if err != nil {
		t.Fatal(err)
	}

	if rows.Next() {
		var val int32
		if err = rows.Scan(&val); err != nil {
			t.Fatal(err)
		}
	} else {
		t.Fatal("Expected at least one row in first query in xact")
	}

	rows2, err := tx.Query("select 2")
	if err != nil {
		t.Fatal(err)
	}

	if rows2.Next() {
		var val2 int32
		if err := rows2.Scan(&val2); err != nil {
			t.Fatal(err)
		}
	} else {
		t.Fatal("Expected at least one row in second query in xact")
	}

	if err = rows.Err(); err != nil {
		t.Fatal(err)
	}

	if err = rows2.Err(); err != nil {
		t.Fatal(err)
	}

	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

var envParseTests = []struct {
	Expected map[string]string
	Env      []string
}{
	{
		Env:      []string{"PGDATABASE=hello", "PGUSER=goodbye"},
		Expected: map[string]string{"dbname": "hello", paramUser: "goodbye"},
	},
	{
		Env:      []string{"PGDATESTYLE=ISO, MDY"},
		Expected: map[string]string{"datestyle": "ISO, MDY"},
	},
	{
		Env:      []string{"PGCONNECT_TIMEOUT=30"},
		Expected: map[string]string{paramConnectTimeout: "30"},
	},
}

func TestParseComplete(t *testing.T) {
	tpc := func(commandTag string, command string, affectedRows int64, shouldFail bool) {
		defer func() {
			if p := recover(); p != nil {
				if !shouldFail {
					t.Error(p)
				}
			}
		}()
		cn := &conn{}
		res, c := cn.parseComplete(commandTag)
		if c != command {
			t.Errorf("Expected %v, got %v", command, c)
		}
		n, err := res.RowsAffected()
		if err != nil {
			t.Fatal(err)
		}
		if n != affectedRows {
			t.Errorf("Expected %d, got %d", affectedRows, n)
		}
	}

	tpc("ALTER TABLE", "ALTER TABLE", 0, false)
	tpc("INSERT 0 1", "INSERT", 1, false)
	tpc("UPDATE 100", "UPDATE", 100, false)
	tpc("SELECT 100", "SELECT", 100, false)
	tpc("FETCH 100", "FETCH", 100, false)
	// allow COPY (and others) without row count
	tpc("COPY", "COPY", 0, false)
	// don't fail on command tags we don't recognize
	tpc("UNKNOWNCOMMANDTAG", "UNKNOWNCOMMANDTAG", 0, false)

	// failure cases
	tpc("INSERT 1", "", 0, true)   // missing oid
	tpc("UPDATE 0 1", "", 0, true) // too many numbers
	tpc("SELECT foo", "", 0, true) // invalid row count
}

// Test interface conformance.
var (
	_ driver.ExecerContext  = (*conn)(nil)
	_ driver.QueryerContext = (*conn)(nil)
)

func TestNullAfterNonNull(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	r, err := db.Query("SELECT 9::integer UNION SELECT NULL::integer")
	if err != nil {
		t.Fatal(err)
	}

	var n sql.NullInt64

	if !r.Next() {
		if r.Err() != nil {
			t.Fatal(err)
		}
		t.Fatal("expected row")
	}

	if err := r.Scan(&n); err != nil {
		t.Fatal(err)
	}

	if n.Int64 != 9 {
		t.Fatalf("expected 2, not %d", n.Int64)
	}

	if !r.Next() {
		if r.Err() != nil {
			t.Fatal(err)
		}
		t.Fatal("expected row")
	}

	if err := r.Scan(&n); err != nil {
		t.Fatal(err)
	}

	if n.Valid {
		t.Fatal("expected n to be invalid")
	}

	if n.Int64 != 0 {
		t.Fatalf("expected n to 2, not %d", n.Int64)
	}
}

func Test64BitErrorChecking(t *testing.T) {
	defer func() {
		if err := recover(); err != nil {
			t.Fatal(
				"panic due to 0xFFFFFFFF != -1 " +
					"when int is 64 bits",
			)
		}
	}()

	db := openTestConn(t)
	defer db.Close()

	r, err := db.Query(
		`SELECT *
FROM (VALUES (0::integer, NULL::text), (1, 'test string')) AS t;`,
	)

	if err != nil {
		t.Fatal(err)
	}

	defer r.Close()

	for r.Next() {
	}
}

func TestCommit(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Exec("CREATE TEMP TABLE temp (a int)")
	if err != nil {
		t.Fatal(err)
	}
	sqlInsert := "INSERT INTO temp VALUES (1)"
	sqlSelect := "SELECT * FROM temp"
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(sqlInsert)
	if err != nil {
		t.Fatal(err)
	}
	err = tx.Commit()
	if err != nil {
		t.Fatal(err)
	}
	var i int
	err = db.QueryRow(sqlSelect).Scan(&i)
	if err != nil {
		t.Fatal(err)
	}
	if i != 1 {
		t.Fatalf("expected 1, got %d", i)
	}
}

func TestErrorClass(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Query("SELECT int 'notint'")
	if err == nil {
		t.Fatal("expected error")
	}
	pge, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *pq.Error, got %#+v", err)
	}
	if pge.Code.Class() != "22" {
		t.Fatalf("expected class 28, got %v", pge.Code.Class())
	}
	if pge.Code.Class().Name() != "data_exception" {
		t.Fatalf("expected data_exception, got %v", pge.Code.Class().Name())
	}
}

func TestRuntimeParameters(t *testing.T) {
	tests := []struct {
		conninfo string
		param    string
		expected string
		success  bool
	}{
		// invalid parameter
		{"DOESNOTEXIST=foo", "", "", false},
		// we can only work with a specific value for these two
		{"client_encoding=SQL_ASCII", "", "", false},
		{"datestyle='ISO, YDM'", "", "", false},
		// "options" should work exactly as it does in libpq
		{"search_path=pqgotest", "search_path", "pqgotest", true},
		// pq should override client_encoding in this case
		{"client_encoding=SQL_ASCII", "client_encoding", "SQL_ASCII", true},
		// allow client_encoding to be set explicitly
		{"client_encoding=UTF8", "client_encoding", "UTF8", true},
		// test a runtime parameter not supported by libpq
		{"work_mem='139kB'", "work_mem", "", false},
		// test fallback_application_name
		{"application_name=foo", "application_name", "foo", true},
		{"application_name=''", "application_name", "''", true},
	}
	dsn, err := getTestDsn()
	if err != nil {
		t.Error(err)
		return
	}
	for _, test := range tests {
		db, err := openTestConnConninfo(fmt.Sprintf("%s&%s", dsn, test.conninfo))
		if err != nil {
			t.Fatal(err)
		}

		// application_name didn't exist before 9.0
		if test.param == "application_name" && getServerVersion(t, db) < 90000 {
			db.Close()
			continue
		}

		tryGetParameterValue := func() (value string, success bool) {
			defer db.Close()
			row := db.QueryRow("SELECT current_setting($1)", test.param)
			err = row.Scan(&value)
			if err != nil {
				// t.Error(err)
				return "", false
			}
			return value, true
		}

		value, success := tryGetParameterValue()
		if success != test.success && !test.success {
			t.Fatalf("%v: unexpected error: %v", test.conninfo, err)
		}
		if success != test.success {
			t.Fatalf(
				"unexpected outcome %v (was expecting %v) for conninfo \"%s\"",
				success, test.success, test.conninfo,
			)
		}
		if value != test.expected {
			t.Fatalf(
				"bad value for %s: got %s, want %s with conninfo \"%s\"",
				test.param, value, test.expected, test.conninfo,
			)
		}
	}
}

func TestIsUTF8(t *testing.T) {
	var cases = []struct {
		name string
		want bool
	}{
		{"unicode", true},
		{"utf-8", true},
		{"utf_8", true},
		{"UTF-8", true},
		{"UTF8", true},
		{"utf8", true},
		{"u n ic_ode", true},
		{"ut_f%8", true},
		{"ubf8", false},
		{"punycode", false},
	}

	for _, test := range cases {
		if g := isUTF8(test.name); g != test.want {
			t.Errorf("isUTF8(%q) = %v want %v", test.name, g, test.want)
		}
	}
}

func TestQuoteIdentifier(t *testing.T) {
	var cases = []struct {
		input string
		want  string
	}{
		{`foo`, `"foo"`},
		{`foo bar baz`, `"foo bar baz"`},
		{`foo"bar`, `"foo""bar"`},
		{"foo\x00bar", `"foo"`},
		{"\x00foo", `""`},
	}

	for _, test := range cases {
		got := QuoteIdentifier(test.input)
		if got != test.want {
			t.Errorf("QuoteIdentifier(%q) = %v want %v", test.input, got, test.want)
		}
	}
}

func TestQuoteLiteral(t *testing.T) {
	var cases = []struct {
		input string
		want  string
	}{
		{`foo`, `'foo'`},
		{`foo bar baz`, `'foo bar baz'`},
		{`foo'bar`, `'foo''bar'`},
		{`foo\bar`, ` E'foo\\bar'`},
		{`foo\ba'r`, ` E'foo\\ba''r'`},
		{`foo"bar`, `'foo"bar'`},
		{`foo\x00bar`, ` E'foo\\x00bar'`},
		{`\x00foo`, ` E'\\x00foo'`},
		{`'`, `''''`},
		{`''`, `''''''`},
		{`\`, ` E'\\'`},
		{`'abc'; DROP TABLE users;`, `'''abc''; DROP TABLE users;'`},
		{`\'`, ` E'\\'''`},
		{`E'\''`, ` E'E''\\'''''`},
		{`e'\''`, ` E'e''\\'''''`},
		{`E'\'abc\'; DROP TABLE users;'`, ` E'E''\\''abc\\''; DROP TABLE users;'''`},
		{`e'\'abc\'; DROP TABLE users;'`, ` E'e''\\''abc\\''; DROP TABLE users;'''`},
	}

	for _, test := range cases {
		got := QuoteLiteral(test.input)
		if got != test.want {
			t.Errorf("QuoteLiteral(%q) = %v want %v", test.input, got, test.want)
		}
	}
}

func TestRowsResultTag(t *testing.T) {
	type ResultTag interface {
		Result() driver.Result
		Tag() string
	}

	tests := []struct {
		query string
		tag   string
		ra    int64
	}{
		{
			query: "CREATE TEMP TABLE temp (a int)",
			tag:   "CREATE TABLE",
		},
		{
			query: "INSERT INTO temp VALUES (1), (2)",
			tag:   "INSERT",
			ra:    2,
		},
		{
			query: "SELECT 1",
		},
		// A SELECT anywhere should take precedent.
		{
			query: "SELECT 1; INSERT INTO temp VALUES (1), (2)",
		},
		{
			query: "INSERT INTO temp VALUES (1), (2); SELECT 1",
		},
		// Multiple statements that don't return rows should return the last tag.
		{
			query: "CREATE TEMP TABLE t (a int); DROP TABLE t",
			tag:   "DROP TABLE",
		},
		// Ensure a rows-returning query in any position among various tags-returing
		// statements will prefer the rows.
		{
			query: "SELECT 1; CREATE TEMP TABLE t (a int); DROP TABLE t",
		},
		{
			query: "CREATE TEMP TABLE t (a int); SELECT 1; DROP TABLE t",
		},
		{
			query: "CREATE TEMP TABLE t (a int); DROP TABLE t; SELECT 1",
		},
	}

	// If this is the only test run, this will correct the connection string.
	openTestConn(t).Close()

	dsn, err := getTestDsn()
	if err != nil {
		t.Error(err)
		return
	}
	conn, err := Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	q := conn.(driver.QueryerContext)

	for _, test := range tests {
		if rows, err := q.QueryContext(context.Background(), test.query, nil); err != nil {
			t.Fatalf("%s: %s", test.query, err)
		} else {
			r := rows.(ResultTag)
			if tag := r.Tag(); tag != test.tag {
				t.Fatalf("%s: unexpected tag %q", test.query, tag)
			}
			res := r.Result()
			if ra, _ := res.RowsAffected(); ra != test.ra {
				t.Fatalf("%s: unexpected rows affected: %d", test.query, ra)
			}
			rows.Close()
		}
	}
}

// TestQuickClose tests that closing a query early allows a subsequent query to work.
func TestQuickClose(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	rows, err := tx.Query("SELECT 1; SELECT 2;")
	if err != nil {
		t.Fatal(err)
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}

	var id int
	if err := tx.QueryRow("SELECT 3").Scan(&id); err != nil {
		t.Fatal(err)
	}
	if id != 3 {
		t.Fatalf("unexpected %d", id)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

func TestMultipleResult(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	rows, err := db.Query(
		`
		begin;
			select * from information_schema.tables limit 1;
			select * from information_schema.columns limit 2;
		commit;
	`,
	)
	if err != nil {
		t.Fatal(err)
	}
	type set struct {
		cols     []string
		rowCount int
	}
	buf := []*set{}
	for {
		cols, err := rows.Columns()
		if err != nil {
			t.Fatal(err)
		}
		s := &set{
			cols: cols,
		}
		buf = append(buf, s)

		for rows.Next() {
			s.rowCount++
		}
		if !rows.NextResultSet() {
			break
		}
	}
	if len(buf) != 2 {
		t.Fatalf("got %d sets, expected 2", len(buf))
	}
	if len(buf[0].cols) == len(buf[1].cols) || len(buf[1].cols) == 0 {
		t.Fatal("invalid cols size, expected different column count and greater then zero")
	}
	if buf[0].rowCount != 1 || buf[1].rowCount != 2 {
		t.Fatal("incorrect number of rows returned")
	}
}

func TestMultipleEmptyResult(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	rows, err := db.Query("select 1 where false; select 2")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		t.Fatal("unexpected row")
	}
	if !rows.NextResultSet() {
		t.Fatal("expected more result sets", rows.Err())
	}
	for rows.Next() {
		var i int
		if err := rows.Scan(&i); err != nil {
			t.Fatal(err)
		}
		if i != 2 {
			t.Fatalf("expected 2, got %d", i)
		}
	}
	if rows.NextResultSet() {
		t.Fatal("unexpected result set")
	}
}

func TestCopyInStmtAffectedRows(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	_, err := db.Exec("CREATE TEMP TABLE temp (a int)")
	if err != nil {
		t.Fatal(err)
	}

	txn, err := db.BeginTx(context.TODO(), nil)
	if err != nil {
		t.Fatal(err)
	}

	copyStmt, err := txn.Prepare(CopyIn("temp", "a"))
	if err != nil {
		t.Fatal(err)
	}

	res, err := copyStmt.Exec()
	if err != nil {
		t.Fatal(err)
	}

	res.RowsAffected()
	res.LastInsertId()
}

// func getDBCharset(db *sql.DB) (string, error) {
// 	var dbCharset string
// 	sqlText := "select pg_encoding_to_char(d.encoding) charset from pg_database d " +
// 		"where datname = current_database()"
// 	err := db.QueryRow(sqlText).Scan(&dbCharset)
// 	return dbCharset, err
// }

// func TestGbkToUTF8Encoding(t *testing.T) {
// 	os.Setenv(
// 		"TEST_CONN_STRING",
// 		"postgres://hongye:hongye@50@121.36.15.2:55448/hongye_gbk?sslmode=disable"+
// 			"&loggerLevel=debug",
// 	)
// 	db := openTestConn(t)
// 	defer db.Close()
// 	var (
// 		err error
// 	)
// 	// dbCharset, err := getDBCharset(db)
// 	// if err != nil {
// 	// 	t.Errorf("getDBCharset %v", err)
// 	// }
//
// 	// if !strings.EqualFold(dbCharset, "UTF8") {
// 	// 	t.Skip("Database Charset not utf8")
// 	// 	return
// 	// }
// 	_, _ = db.Exec("drop table test_utf8_gbk")
// 	_, err = db.Exec(
// 		"CREATE TABLE test_utf8_gbk (" +
// 			"id bigint," +
// 			"COL_UTF8 varchar(100)," +
// 			"COL_GBK varchar(100)" +
// 			")",
// 	)
// 	if err != nil {
// 		t.Fatal(err)
// 	}
// 	var clientCharset string
// 	_ = db.QueryRow("show client_encoding").Scan(&clientCharset)
// 	var (
// 		id  = 1
// 		str = "请求IC卡系统响应"
// 	)
//
// 	gbkEnc, err := ianaindex.MIB.Encoding("GBk")
// 	if err != nil {
// 		t.Errorf(`%+v`, err)
// 		return
// 	}
// 	tmp, err := ioutil.ReadAll(
// 		transform.NewReader(bytes.NewReader([]byte(str)), gbkEnc.NewEncoder()),
// 	)
// 	if err != nil {
// 		t.Errorf(`%+v`, err)
// 		return
// 	}
// 	gbkStr := string(tmp)
//
// 	utf8Enc, err := ianaindex.MIB.Encoding("UTF-8")
// 	if err != nil {
// 		t.Errorf(`%+v`, err)
// 		return
// 	}
// 	tmp, err = ioutil.ReadAll(
// 		transform.NewReader(bytes.NewReader([]byte(gbkStr)), utf8Enc.NewEncoder()),
// 	)
// 	if err != nil {
// 		t.Errorf(`%+v`, err)
// 		return
// 	}
// 	gbkUtf8Str := string(tmp)
// 	_, err = db.Exec(
// 		"insert into test_utf8_gbk (id,COL_UTF8,COL_GBK) values (:1,:2,:3)", id, str, gbkStr,
// 	)
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	// _, err = stmt.Exec(id, str, gbkStr)
// 	// if err != nil {
// 	// 	t.Error(err)
// 	// 	return
// 	// }
// 	tx, err := db.Begin()
// 	stmt, err := tx.Prepare("copy test_utf8_gbk(id,COL_UTF8,COL_GBK) from stdin")
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
//
// 	if _, err = stmt.Exec(id+1, str, gbkStr); err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	if _, err := stmt.Exec(); err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	_ = tx.Commit()
//
// 	os.Setenv(
// 		"TEST_CONN_STRING",
// 		"postgres://hongye:hongye@50@121.36.15.2:55448/hongye_gbk?sslmode=disable"+
// 			"&loggerLevel=debug",
// 	)
// 	db1 := openTestConn(t)
// 	defer db1.Close()
// 	_ = db1.QueryRow("show client_encoding").Scan(&clientCharset)
// 	rows, err := db1.Query("select id,COL_UTF8,COL_GBK from test_utf8_gbk")
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	for rows.Next() {
// 		var id, colUtf8, colGbk string
// 		if err := rows.Scan(&id, &colUtf8, &colGbk); err != nil {
// 			t.Error(err)
// 			return
// 		}
// 		fmt.Printf("%s %s(%x) %s(%x)\n", id, colUtf8, colUtf8, colGbk, colGbk)
// 		assert.Equal(t, gbkUtf8Str, colGbk)
// 	}
// }
//
func Test_Clob_Text_Blob_Bytea(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()
	var clientCharset string
	_ = db.QueryRow("show client_encoding").Scan(&clientCharset)
	var err error
	_, _ = db.Exec("drop table Table_Blob_Bytea")
	if _, err = db.Exec(
		"create table Table_Blob_Bytea(id bigint,c_blob blob,c_bytea bytea," +
			"c_clob clob,c_text text)",
	); err != nil {
		t.Error(err)
		return
	}

	var ab = "我是中国人"
	result := make([]byte, hex.EncodedLen(len(ab)))
	hex.Encode(result, []byte(ab))
	sqlText := "insert into Table_Blob_Bytea (id,c_blob,c_bytea,c_clob,c_text) values (:1,:2,:3,:4,:5)"
	if _, err = db.Exec(
		sqlText,
		1,
		ab, []byte(ab),
		ab, "db.Exec",
	); err != nil {
		t.Error(err)
		return
	}

	stmt, err := db.Prepare(sqlText)
	if err != nil {
		t.Error(err)
		return
	}
	_, err = stmt.Exec(
		2,
		[]byte(ab), ab,
		ab, "stmt.Exec",
	)
	if err != nil {
		t.Error(err)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		t.Error(err)
		return
	}
	defer tx.Rollback()
	st, err := tx.Prepare("copy Table_Blob_Bytea(id,c_blob,c_bytea,c_clob,c_text) from STDIN")
	if err != nil {
		t.Error(err)
		return
	}
	_, err = st.Exec(3, string(result), []byte(ab), ab, "copy Exec")
	if err != nil {
		t.Error(err)
		return
	}
	_, err = st.Exec()
	if err != nil {
		t.Error(err)
		return
	}
	err = tx.Commit()
	if err != nil {
		t.Error(err)
		return
	}
	rows, err := db.Query("select * from Table_Blob_Bytea")
	if err != nil {
		t.Error(err)
		return
	}
	for rows.Next() {
		var id, cBlob, cBytes, cClob, cText string
		if err := rows.Scan(&id, &cBlob, &cBytes, &cClob, &cText); err != nil {
			t.Error(err)
			return
		}
		assert.Equal(t, ab, cBlob)
		fmt.Println(id, cBlob, cBytes, cClob, cText)
	}
}
