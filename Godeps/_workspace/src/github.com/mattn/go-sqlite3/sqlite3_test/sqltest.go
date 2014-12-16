package sqlite3_test

import (
	"database/sql"
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"sync"
	"testing"
	"time"
)

type Dialect int

const (
	SQLITE Dialect = iota
	POSTGRESQL
	MYSQL
)

type DB struct {
	*testing.T
	*sql.DB
	dialect Dialect
	once    sync.Once
}

var db *DB

// the following tables will be created and dropped during the test
var testTables = []string{"foo", "bar", "t", "bench"}

var tests = []testing.InternalTest{
	{"TestBlobs", TestBlobs},
	{"TestManyQueryRow", TestManyQueryRow},
	{"TestTxQuery", TestTxQuery},
	{"TestPreparedStmt", TestPreparedStmt},
}

var benchmarks = []testing.InternalBenchmark{
	{"BenchmarkExec", BenchmarkExec},
	{"BenchmarkQuery", BenchmarkQuery},
	{"BenchmarkParams", BenchmarkParams},
	{"BenchmarkStmt", BenchmarkStmt},
	{"BenchmarkRows", BenchmarkRows},
	{"BenchmarkStmtRows", BenchmarkStmtRows},
}

// RunTests runs the SQL test suite
func RunTests(t *testing.T, d *sql.DB, dialect Dialect) {
	db = &DB{t, d, dialect, sync.Once{}}
	testing.RunTests(func(string, string) (bool, error) { return true, nil }, tests)

	if !testing.Short() {
		for _, b := range benchmarks {
			fmt.Printf("%-20s", b.Name)
			r := testing.Benchmark(b.F)
			fmt.Printf("%10d %10.0f req/s\n", r.N, float64(r.N)/r.T.Seconds())
		}
	}
	db.tearDown()
}

func (db *DB) mustExec(sql string, args ...interface{}) sql.Result {
	res, err := db.Exec(sql, args...)
	if err != nil {
		db.Fatalf("Error running %q: %v", sql, err)
	}
	return res
}

func (db *DB) tearDown() {
	for _, tbl := range testTables {
		switch db.dialect {
		case SQLITE:
			db.mustExec("drop table if exists " + tbl)
		case MYSQL, POSTGRESQL:
			db.mustExec("drop table if exists " + tbl)
		default:
			db.Fatal("unkown dialect")
		}
	}
}

// q replaces ? parameters if needed
func (db *DB) q(sql string) string {
	switch db.dialect {
	case POSTGRESQL: // repace with $1, $2, ..
		qrx := regexp.MustCompile(`\?`)
		n := 0
		return qrx.ReplaceAllStringFunc(sql, func(string) string {
			n++
			return "$" + strconv.Itoa(n)
		})
	}
	return sql
}

func (db *DB) blobType(size int) string {
	switch db.dialect {
	case SQLITE:
		return fmt.Sprintf("blob[%d]", size)
	case POSTGRESQL:
		return "bytea"
	case MYSQL:
		return fmt.Sprintf("VARBINARY(%d)", size)
	}
	panic("unkown dialect")
}

func (db *DB) serialPK() string {
	switch db.dialect {
	case SQLITE:
		return "integer primary key autoincrement"
	case POSTGRESQL:
		return "serial primary key"
	case MYSQL:
		return "integer primary key auto_increment"
	}
	panic("unkown dialect")
}

func (db *DB) now() string {
	switch db.dialect {
	case SQLITE:
		return "datetime('now')"
	case POSTGRESQL:
		return "now()"
	case MYSQL:
		return "now()"
	}
	panic("unkown dialect")
}

func makeBench() {
	if _, err := db.Exec("create table bench (n varchar(32), i integer, d double, s varchar(32), t datetime)"); err != nil {
		panic(err)
	}
	st, err := db.Prepare("insert into bench values (?, ?, ?, ?, ?)")
	if err != nil {
		panic(err)
	}
	defer st.Close()
	for i := 0; i < 100; i++ {
		if _, err = st.Exec(nil, i, float64(i), fmt.Sprintf("%d", i), time.Now()); err != nil {
			panic(err)
		}
	}
}

func TestResult(t *testing.T) {
	db.tearDown()
	db.mustExec("create temporary table test (id " + db.serialPK() + ", name varchar(10))")

	for i := 1; i < 3; i++ {
		r := db.mustExec(db.q("insert into test (name) values (?)"), fmt.Sprintf("row %d", i))
		n, err := r.RowsAffected()
		if err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Errorf("got %v, want %v", n, 1)
		}
		n, err = r.LastInsertId()
		if err != nil {
			t.Fatal(err)
		}
		if n != int64(i) {
			t.Errorf("got %v, want %v", n, i)
		}
	}
	if _, err := db.Exec("error!"); err == nil {
		t.Fatalf("expected error")
	}
}

func TestBlobs(t *testing.T) {
	db.tearDown()
	var blob = []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
	db.mustExec("create table foo (id integer primary key, bar " + db.blobType(16) + ")")
	db.mustExec(db.q("insert into foo (id, bar) values(?,?)"), 0, blob)

	want := fmt.Sprintf("%x", blob)

	b := make([]byte, 16)
	err := db.QueryRow(db.q("select bar from foo where id = ?"), 0).Scan(&b)
	got := fmt.Sprintf("%x", b)
	if err != nil {
		t.Errorf("[]byte scan: %v", err)
	} else if got != want {
		t.Errorf("for []byte, got %q; want %q", got, want)
	}

	err = db.QueryRow(db.q("select bar from foo where id = ?"), 0).Scan(&got)
	want = string(blob)
	if err != nil {
		t.Errorf("string scan: %v", err)
	} else if got != want {
		t.Errorf("for string, got %q; want %q", got, want)
	}
}

func TestManyQueryRow(t *testing.T) {
	if testing.Short() {
		t.Log("skipping in short mode")
		return
	}
	db.tearDown()
	db.mustExec("create table foo (id integer primary key, name varchar(50))")
	db.mustExec(db.q("insert into foo (id, name) values(?,?)"), 1, "bob")
	var name string
	for i := 0; i < 10000; i++ {
		err := db.QueryRow(db.q("select name from foo where id = ?"), 1).Scan(&name)
		if err != nil || name != "bob" {
			t.Fatalf("on query %d: err=%v, name=%q", i, err, name)
		}
	}
}

func TestTxQuery(t *testing.T) {
	db.tearDown()
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	_, err = tx.Exec("create table foo (id integer primary key, name varchar(50))")
	if err != nil {
		t.Fatal(err)
	}

	_, err = tx.Exec(db.q("insert into foo (id, name) values(?,?)"), 1, "bob")
	if err != nil {
		t.Fatal(err)
	}

	r, err := tx.Query(db.q("select name from foo where id = ?"), 1)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	if !r.Next() {
		if r.Err() != nil {
			t.Fatal(err)
		}
		t.Fatal("expected one rows")
	}

	var name string
	err = r.Scan(&name)
	if err != nil {
		t.Fatal(err)
	}
}

func TestPreparedStmt(t *testing.T) {
	db.tearDown()
	db.mustExec("CREATE TABLE t (count INT)")
	sel, err := db.Prepare("SELECT count FROM t ORDER BY count DESC")
	if err != nil {
		t.Fatalf("prepare 1: %v", err)
	}
	ins, err := db.Prepare(db.q("INSERT INTO t (count) VALUES (?)"))
	if err != nil {
		t.Fatalf("prepare 2: %v", err)
	}

	for n := 1; n <= 3; n++ {
		if _, err := ins.Exec(n); err != nil {
			t.Fatalf("insert(%d) = %v", n, err)
		}
	}

	const nRuns = 10
	ch := make(chan bool)
	for i := 0; i < nRuns; i++ {
		go func() {
			defer func() {
				ch <- true
			}()
			for j := 0; j < 10; j++ {
				count := 0
				if err := sel.QueryRow().Scan(&count); err != nil && err != sql.ErrNoRows {
					t.Errorf("Query: %v", err)
					return
				}
				if _, err := ins.Exec(rand.Intn(100)); err != nil {
					t.Errorf("Insert: %v", err)
					return
				}
			}
		}()
	}
	for i := 0; i < nRuns; i++ {
		<-ch
	}
}

// Benchmarks need to use panic() since b.Error errors are lost when
// running via testing.Benchmark() I would like to run these via go
// test -bench but calling Benchmark() from a benchmark test
// currently hangs go.

func BenchmarkExec(b *testing.B) {
	for i := 0; i < b.N; i++ {
		if _, err := db.Exec("select 1"); err != nil {
			panic(err)
		}
	}
}

func BenchmarkQuery(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var n sql.NullString
		var i int
		var f float64
		var s string
		//		var t time.Time
		if err := db.QueryRow("select null, 1, 1.1, 'foo'").Scan(&n, &i, &f, &s); err != nil {
			panic(err)
		}
	}
}

func BenchmarkParams(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var n sql.NullString
		var i int
		var f float64
		var s string
		//		var t time.Time
		if err := db.QueryRow("select ?, ?, ?, ?", nil, 1, 1.1, "foo").Scan(&n, &i, &f, &s); err != nil {
			panic(err)
		}
	}
}

func BenchmarkStmt(b *testing.B) {
	st, err := db.Prepare("select ?, ?, ?, ?")
	if err != nil {
		panic(err)
	}
	defer st.Close()

	for n := 0; n < b.N; n++ {
		var n sql.NullString
		var i int
		var f float64
		var s string
		//		var t time.Time
		if err := st.QueryRow(nil, 1, 1.1, "foo").Scan(&n, &i, &f, &s); err != nil {
			panic(err)
		}
	}
}

func BenchmarkRows(b *testing.B) {
	db.once.Do(makeBench)

	for n := 0; n < b.N; n++ {
		var n sql.NullString
		var i int
		var f float64
		var s string
		var t time.Time
		r, err := db.Query("select * from bench")
		if err != nil {
			panic(err)
		}
		for r.Next() {
			if err = r.Scan(&n, &i, &f, &s, &t); err != nil {
				panic(err)
			}
		}
		if err = r.Err(); err != nil {
			panic(err)
		}
	}
}

func BenchmarkStmtRows(b *testing.B) {
	db.once.Do(makeBench)

	st, err := db.Prepare("select * from bench")
	if err != nil {
		panic(err)
	}
	defer st.Close()

	for n := 0; n < b.N; n++ {
		var n sql.NullString
		var i int
		var f float64
		var s string
		var t time.Time
		r, err := st.Query()
		if err != nil {
			panic(err)
		}
		for r.Next() {
			if err = r.Scan(&n, &i, &f, &s, &t); err != nil {
				panic(err)
			}
		}
		if err = r.Err(); err != nil {
			panic(err)
		}
	}
}
