// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mattn/go-sqlite3/sqlite3_test"
)

func TempFilename() string {
	randBytes := make([]byte, 16)
	rand.Read(randBytes)
	return filepath.Join(os.TempDir(), "foo"+hex.EncodeToString(randBytes)+".db")
}

func TestOpen(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("drop table foo")
	_, err = db.Exec("create table foo (id integer)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	if stat, err := os.Stat(tempFilename); err != nil || stat.IsDir() {
		t.Error("Failed to create ./foo.db")
	}
}

func TestClose(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)

	_, err = db.Exec("drop table foo")
	_, err = db.Exec("create table foo (id integer)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	stmt, err := db.Prepare("select id from foo where id = ?")
	if err != nil {
		t.Fatal("Failed to select records:", err)
	}

	db.Close()
	_, err = stmt.Exec(1)
	if err == nil {
		t.Fatal("Failed to operate closed statement")
	}
}

func TestInsert(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("drop table foo")
	_, err = db.Exec("create table foo (id integer)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	res, err := db.Exec("insert into foo(id) values(123)")
	if err != nil {
		t.Fatal("Failed to insert record:", err)
	}
	affected, _ := res.RowsAffected()
	if affected != 1 {
		t.Fatalf("Expected %d for affected rows, but %d:", 1, affected)
	}

	rows, err := db.Query("select id from foo")
	if err != nil {
		t.Fatal("Failed to select records:", err)
	}
	defer rows.Close()

	rows.Next()

	var result int
	rows.Scan(&result)
	if result != 123 {
		t.Errorf("Fetched %q; expected %q", 123, result)
	}
}

func TestUpdate(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("drop table foo")
	_, err = db.Exec("create table foo (id integer)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	res, err := db.Exec("insert into foo(id) values(123)")
	if err != nil {
		t.Fatal("Failed to insert record:", err)
	}
	expected, err := res.LastInsertId()
	if err != nil {
		t.Fatal("Failed to get LastInsertId:", err)
	}
	affected, _ := res.RowsAffected()
	if err != nil {
		t.Fatal("Failed to get RowsAffected:", err)
	}
	if affected != 1 {
		t.Fatalf("Expected %d for affected rows, but %d:", 1, affected)
	}

	res, err = db.Exec("update foo set id = 234")
	if err != nil {
		t.Fatal("Failed to update record:", err)
	}
	lastId, err := res.LastInsertId()
	if err != nil {
		t.Fatal("Failed to get LastInsertId:", err)
	}
	if expected != lastId {
		t.Errorf("Expected %q for last Id, but %q:", expected, lastId)
	}
	affected, _ = res.RowsAffected()
	if err != nil {
		t.Fatal("Failed to get RowsAffected:", err)
	}
	if affected != 1 {
		t.Fatalf("Expected %d for affected rows, but %d:", 1, affected)
	}

	rows, err := db.Query("select id from foo")
	if err != nil {
		t.Fatal("Failed to select records:", err)
	}
	defer rows.Close()

	rows.Next()

	var result int
	rows.Scan(&result)
	if result != 234 {
		t.Errorf("Fetched %q; expected %q", 234, result)
	}
}

func TestDelete(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("drop table foo")
	_, err = db.Exec("create table foo (id integer)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	res, err := db.Exec("insert into foo(id) values(123)")
	if err != nil {
		t.Fatal("Failed to insert record:", err)
	}
	expected, err := res.LastInsertId()
	if err != nil {
		t.Fatal("Failed to get LastInsertId:", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		t.Fatal("Failed to get RowsAffected:", err)
	}
	if affected != 1 {
		t.Errorf("Expected %d for cout of affected rows, but %q:", 1, affected)
	}

	res, err = db.Exec("delete from foo where id = 123")
	if err != nil {
		t.Fatal("Failed to delete record:", err)
	}
	lastId, err := res.LastInsertId()
	if err != nil {
		t.Fatal("Failed to get LastInsertId:", err)
	}
	if expected != lastId {
		t.Errorf("Expected %q for last Id, but %q:", expected, lastId)
	}
	affected, err = res.RowsAffected()
	if err != nil {
		t.Fatal("Failed to get RowsAffected:", err)
	}
	if affected != 1 {
		t.Errorf("Expected %d for cout of affected rows, but %q:", 1, affected)
	}

	rows, err := db.Query("select id from foo")
	if err != nil {
		t.Fatal("Failed to select records:", err)
	}
	defer rows.Close()

	if rows.Next() {
		t.Error("Fetched row but expected not rows")
	}
}

func TestBooleanRoundtrip(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("DROP TABLE foo")
	_, err = db.Exec("CREATE TABLE foo(id INTEGER, value BOOL)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	_, err = db.Exec("INSERT INTO foo(id, value) VALUES(1, ?)", true)
	if err != nil {
		t.Fatal("Failed to insert true value:", err)
	}

	_, err = db.Exec("INSERT INTO foo(id, value) VALUES(2, ?)", false)
	if err != nil {
		t.Fatal("Failed to insert false value:", err)
	}

	rows, err := db.Query("SELECT id, value FROM foo")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var value bool

		if err := rows.Scan(&id, &value); err != nil {
			t.Error("Unable to scan results:", err)
			continue
		}

		if id == 1 && !value {
			t.Error("Value for id 1 should be true, not false")

		} else if id == 2 && value {
			t.Error("Value for id 2 should be false, not true")
		}
	}
}

func TestTimestamp(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("DROP TABLE foo")
	_, err = db.Exec("CREATE TABLE foo(id INTEGER, ts timeSTAMP, dt DATETIME)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	timestamp1 := time.Date(2012, time.April, 6, 22, 50, 0, 0, time.UTC)
	timestamp2 := time.Date(2006, time.January, 2, 15, 4, 5, 123456789, time.UTC)
	timestamp3 := time.Date(2012, time.November, 4, 0, 0, 0, 0, time.UTC)
	tests := []struct {
		value    interface{}
		expected time.Time
	}{
		{"nonsense", time.Time{}},
		{"0000-00-00 00:00:00", time.Time{}},
		{timestamp1, timestamp1},
		{timestamp1.Unix(), timestamp1},
		{timestamp1.UnixNano() / int64(time.Millisecond), timestamp1},
		{timestamp1.In(time.FixedZone("TEST", -7*3600)), timestamp1},
		{timestamp1.Format("2006-01-02 15:04:05.000"), timestamp1},
		{timestamp1.Format("2006-01-02T15:04:05.000"), timestamp1},
		{timestamp1.Format("2006-01-02 15:04:05"), timestamp1},
		{timestamp1.Format("2006-01-02T15:04:05"), timestamp1},
		{timestamp2, timestamp2},
		{"2006-01-02 15:04:05.123456789", timestamp2},
		{"2006-01-02T15:04:05.123456789", timestamp2},
		{"2012-11-04", timestamp3},
		{"2012-11-04 00:00", timestamp3},
		{"2012-11-04 00:00:00", timestamp3},
		{"2012-11-04 00:00:00.000", timestamp3},
		{"2012-11-04T00:00", timestamp3},
		{"2012-11-04T00:00:00", timestamp3},
		{"2012-11-04T00:00:00.000", timestamp3},
	}
	for i := range tests {
		_, err = db.Exec("INSERT INTO foo(id, ts, dt) VALUES(?, ?, ?)", i, tests[i].value, tests[i].value)
		if err != nil {
			t.Fatal("Failed to insert timestamp:", err)
		}
	}

	rows, err := db.Query("SELECT id, ts, dt FROM foo ORDER BY id ASC")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}
	defer rows.Close()

	seen := 0
	for rows.Next() {
		var id int
		var ts, dt time.Time

		if err := rows.Scan(&id, &ts, &dt); err != nil {
			t.Error("Unable to scan results:", err)
			continue
		}
		if id < 0 || id >= len(tests) {
			t.Error("Bad row id: ", id)
			continue
		}
		seen++
		if !tests[id].expected.Equal(ts) {
			t.Errorf("Timestamp value for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected, dt)
		}
		if !tests[id].expected.Equal(dt) {
			t.Errorf("Datetime value for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected, dt)
		}
	}

	if seen != len(tests) {
		t.Errorf("Expected to see %d rows", len(tests))
	}
}

func TestBoolean(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("CREATE TABLE foo(id INTEGER, fbool BOOLEAN)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	bool1 := true
	_, err = db.Exec("INSERT INTO foo(id, fbool) VALUES(1, ?)", bool1)
	if err != nil {
		t.Fatal("Failed to insert boolean:", err)
	}

	bool2 := false
	_, err = db.Exec("INSERT INTO foo(id, fbool) VALUES(2, ?)", bool2)
	if err != nil {
		t.Fatal("Failed to insert boolean:", err)
	}

	bool3 := "nonsense"
	_, err = db.Exec("INSERT INTO foo(id, fbool) VALUES(3, ?)", bool3)
	if err != nil {
		t.Fatal("Failed to insert nonsense:", err)
	}

	rows, err := db.Query("SELECT id, fbool FROM foo where fbool = ?", bool1)
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}
	counter := 0

	var id int
	var fbool bool

	for rows.Next() {
		if err := rows.Scan(&id, &fbool); err != nil {
			t.Fatal("Unable to scan results:", err)
		}
		counter++
	}

	if counter != 1 {
		t.Fatalf("Expected 1 row but %v", counter)
	}

	if id != 1 && fbool != true {
		t.Fatalf("Value for id 1 should be %v, not %v", bool1, fbool)
	}

	rows, err = db.Query("SELECT id, fbool FROM foo where fbool = ?", bool2)
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}

	counter = 0

	for rows.Next() {
		if err := rows.Scan(&id, &fbool); err != nil {
			t.Fatal("Unable to scan results:", err)
		}
		counter++
	}

	if counter != 1 {
		t.Fatalf("Expected 1 row but %v", counter)
	}

	if id != 2 && fbool != false {
		t.Fatalf("Value for id 2 should be %v, not %v", bool2, fbool)
	}

	// make sure "nonsense" triggered an error
	rows, err = db.Query("SELECT id, fbool FROM foo where id=?;", 3)
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}

	rows.Next()
	err = rows.Scan(&id, &fbool)
	if err == nil {
		t.Error("Expected error from \"nonsense\" bool")
	}
}

func TestFloat32(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("CREATE TABLE foo(id INTEGER)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	_, err = db.Exec("INSERT INTO foo(id) VALUES(null)")
	if err != nil {
		t.Fatal("Failed to insert null:", err)
	}

	rows, err := db.Query("SELECT id FROM foo")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}

	if !rows.Next() {
		t.Fatal("Unable to query results:", err)
	}

	var id interface{}
	if err := rows.Scan(&id); err != nil {
		t.Fatal("Unable to scan results:", err)
	}
	if id != nil {
		t.Error("Expected nil but not")
	}
}

func TestNull(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	defer os.Remove(tempFilename)
	defer db.Close()

	rows, err := db.Query("SELECT 3.141592")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}

	if !rows.Next() {
		t.Fatal("Unable to query results:", err)
	}

	var v interface{}
	if err := rows.Scan(&v); err != nil {
		t.Fatal("Unable to scan results:", err)
	}
	f, ok := v.(float64)
	if !ok {
		t.Error("Expected float but not")
	}
	if f != 3.141592 {
		t.Error("Expected 3.141592 but not")
	}
}

func TestTransaction(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("CREATE TABLE foo(id INTEGER)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	tx, err := db.Begin()
	if err != nil {
		t.Fatal("Failed to begin transaction:", err)
	}

	_, err = tx.Exec("INSERT INTO foo(id) VALUES(1)")
	if err != nil {
		t.Fatal("Failed to insert null:", err)
	}

	rows, err := tx.Query("SELECT id from foo")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}

	err = tx.Rollback()
	if err != nil {
		t.Fatal("Failed to rollback transaction:", err)
	}

	if rows.Next() {
		t.Fatal("Unable to query results:", err)
	}

	tx, err = db.Begin()
	if err != nil {
		t.Fatal("Failed to begin transaction:", err)
	}

	_, err = tx.Exec("INSERT INTO foo(id) VALUES(1)")
	if err != nil {
		t.Fatal("Failed to insert null:", err)
	}

	err = tx.Commit()
	if err != nil {
		t.Fatal("Failed to commit transaction:", err)
	}

	rows, err = tx.Query("SELECT id from foo")
	if err == nil {
		t.Fatal("Expected failure to query")
	}
}

func TestWAL(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	defer os.Remove(tempFilename)
	defer db.Close()
	if _, err = db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		t.Fatal("Failed to Exec PRAGMA journal_mode:", err)
	}
	if _, err = db.Exec("PRAGMA locking_mode=EXCLUSIVE;"); err != nil {
		t.Fatal("Failed to Exec PRAGMA locking_mode:", err)
	}
	if _, err = db.Exec("CREATE TABLE test (id SERIAL, user TEXT NOT NULL, name TEXT NOT NULL);"); err != nil {
		t.Fatal("Failed to Exec CREATE TABLE:", err)
	}
	if _, err = db.Exec("INSERT INTO test (user, name) VALUES ('user','name');"); err != nil {
		t.Fatal("Failed to Exec INSERT:", err)
	}

	trans, err := db.Begin()
	if err != nil {
		t.Fatal("Failed to Begin:", err)
	}
	s, err := trans.Prepare("INSERT INTO test (user, name) VALUES (?, ?);")
	if err != nil {
		t.Fatal("Failed to Prepare:", err)
	}

	var count int
	if err = trans.QueryRow("SELECT count(user) FROM test;").Scan(&count); err != nil {
		t.Fatal("Failed to QueryRow:", err)
	}
	if _, err = s.Exec("bbbb", "aaaa"); err != nil {
		t.Fatal("Failed to Exec prepared statement:", err)
	}
	if err = s.Close(); err != nil {
		t.Fatal("Failed to Close prepared statement:", err)
	}
	if err = trans.Commit(); err != nil {
		t.Fatal("Failed to Commit:", err)
	}
}

func TestTimezoneConversion(t *testing.T) {
	zones := []string{"UTC", "US/Central", "US/Pacific", "Local"}
	for _, tz := range zones {
		tempFilename := TempFilename()
		db, err := sql.Open("sqlite3", tempFilename+"?_loc="+url.QueryEscape(tz))
		if err != nil {
			t.Fatal("Failed to open database:", err)
		}
		defer os.Remove(tempFilename)
		defer db.Close()

		_, err = db.Exec("DROP TABLE foo")
		_, err = db.Exec("CREATE TABLE foo(id INTEGER, ts TIMESTAMP, dt DATETIME)")
		if err != nil {
			t.Fatal("Failed to create table:", err)
		}

		loc, err := time.LoadLocation(tz)
		if err != nil {
			t.Fatal("Failed to load location:", err)
		}

		timestamp1 := time.Date(2012, time.April, 6, 22, 50, 0, 0, time.UTC)
		timestamp2 := time.Date(2006, time.January, 2, 15, 4, 5, 123456789, time.UTC)
		timestamp3 := time.Date(2012, time.November, 4, 0, 0, 0, 0, time.UTC)
		tests := []struct {
			value    interface{}
			expected time.Time
		}{
			{"nonsense", time.Time{}.In(loc)},
			{"0000-00-00 00:00:00", time.Time{}.In(loc)},
			{timestamp1, timestamp1.In(loc)},
			{timestamp1.Unix(), timestamp1.In(loc)},
			{timestamp1.In(time.FixedZone("TEST", -7*3600)), timestamp1.In(loc)},
			{timestamp1.Format("2006-01-02 15:04:05.000"), timestamp1.In(loc)},
			{timestamp1.Format("2006-01-02T15:04:05.000"), timestamp1.In(loc)},
			{timestamp1.Format("2006-01-02 15:04:05"), timestamp1.In(loc)},
			{timestamp1.Format("2006-01-02T15:04:05"), timestamp1.In(loc)},
			{timestamp2, timestamp2.In(loc)},
			{"2006-01-02 15:04:05.123456789", timestamp2.In(loc)},
			{"2006-01-02T15:04:05.123456789", timestamp2.In(loc)},
			{"2012-11-04", timestamp3.In(loc)},
			{"2012-11-04 00:00", timestamp3.In(loc)},
			{"2012-11-04 00:00:00", timestamp3.In(loc)},
			{"2012-11-04 00:00:00.000", timestamp3.In(loc)},
			{"2012-11-04T00:00", timestamp3.In(loc)},
			{"2012-11-04T00:00:00", timestamp3.In(loc)},
			{"2012-11-04T00:00:00.000", timestamp3.In(loc)},
		}
		for i := range tests {
			_, err = db.Exec("INSERT INTO foo(id, ts, dt) VALUES(?, ?, ?)", i, tests[i].value, tests[i].value)
			if err != nil {
				t.Fatal("Failed to insert timestamp:", err)
			}
		}

		rows, err := db.Query("SELECT id, ts, dt FROM foo ORDER BY id ASC")
		if err != nil {
			t.Fatal("Unable to query foo table:", err)
		}
		defer rows.Close()

		seen := 0
		for rows.Next() {
			var id int
			var ts, dt time.Time

			if err := rows.Scan(&id, &ts, &dt); err != nil {
				t.Error("Unable to scan results:", err)
				continue
			}
			if id < 0 || id >= len(tests) {
				t.Error("Bad row id: ", id)
				continue
			}
			seen++
			if !tests[id].expected.Equal(ts) {
				t.Errorf("Timestamp value for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected, ts)
			}
			if !tests[id].expected.Equal(dt) {
				t.Errorf("Datetime value for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected, dt)
			}
			if tests[id].expected.Location().String() != ts.Location().String() {
				t.Errorf("Location for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected.Location().String(), ts.Location().String())
			}
			if tests[id].expected.Location().String() != dt.Location().String() {
				t.Errorf("Location for id %v (%v) should be %v, not %v", id, tests[id].value, tests[id].expected.Location().String(), dt.Location().String())
			}
		}

		if seen != len(tests) {
			t.Errorf("Expected to see %d rows", len(tests))
		}
	}
}

func TestSuite(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	sqlite3_test.RunTests(t, db, sqlite3_test.SQLITE)
}

// TODO: Execer & Queryer currently disabled
// https://github.com/mattn/go-sqlite3/issues/82
func TestExecer(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec(`
       create table foo (id integer); -- one comment
       insert into foo(id) values(?);
       insert into foo(id) values(?);
       insert into foo(id) values(?); -- another comment
       `, 1, 2, 3)
	if err != nil {
		t.Error("Failed to call db.Exec:", err)
	}
}

func TestQueryer(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec(`
	create table foo (id integer);
	`)
	if err != nil {
		t.Error("Failed to call db.Query:", err)
	}

	rows, err := db.Query(`
	insert into foo(id) values(?);
	insert into foo(id) values(?);
	insert into foo(id) values(?);
	select id from foo order by id;
	`, 3, 2, 1)
	if err != nil {
		t.Error("Failed to call db.Query:", err)
	}
	defer rows.Close()
	n := 1
	if rows != nil {
		for rows.Next() {
			var id int
			err = rows.Scan(&id)
			if err != nil {
				t.Error("Failed to db.Query:", err)
			}
			if id != n {
				t.Error("Failed to db.Query: not matched results")
			}
		}
	}
}

func TestStress(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	db.Exec("CREATE TABLE foo (id int);")
	db.Exec("INSERT INTO foo VALUES(1);")
	db.Exec("INSERT INTO foo VALUES(2);")
	db.Close()

	for i := 0; i < 10000; i++ {
		db, err := sql.Open("sqlite3", tempFilename)
		if err != nil {
			t.Fatal("Failed to open database:", err)
		}

		for j := 0; j < 3; j++ {
			rows, err := db.Query("select * from foo where id=1;")
			if err != nil {
				t.Error("Failed to call db.Query:", err)
			}
			for rows.Next() {
				var i int
				if err := rows.Scan(&i); err != nil {
					t.Errorf("Scan failed: %v\n", err)
				}
			}
			if err := rows.Err(); err != nil {
				t.Errorf("Post-scan failed: %v\n", err)
			}
			rows.Close()
		}
		db.Close()
	}
}

func TestDateTimeLocal(t *testing.T) {
	zone := "Asia/Tokyo"
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename+"?_loc="+zone)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	db.Exec("CREATE TABLE foo (dt datetime);")
	db.Exec("INSERT INTO foo VALUES('2015-03-05 15:16:17');")

	row := db.QueryRow("select * from foo")
	var d time.Time
	err = row.Scan(&d)
	if err != nil {
		t.Fatal("Failed to scan datetime:", err)
	}
	if d.Hour() == 15 || !strings.Contains(d.String(), "JST") {
		t.Fatal("Result should have timezone", d)
	}
	db.Close()

	db, err = sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	row = db.QueryRow("select * from foo")
	err = row.Scan(&d)
	if err != nil {
		t.Fatal("Failed to scan datetime:", err)
	}
	if d.UTC().Hour() != 15 || !strings.Contains(d.String(), "UTC") {
		t.Fatalf("Result should not have timezone %v %v", zone, d.String())
	}

	_, err = db.Exec("DELETE FROM foo")
	if err != nil {
		t.Fatal("Failed to delete table:", err)
	}
	dt, err := time.Parse("2006/1/2 15/4/5 -0700 MST", "2015/3/5 15/16/17 +0900 JST")
	if err != nil {
		t.Fatal("Failed to parse datetime:", err)
	}
	db.Exec("INSERT INTO foo VALUES(?);", dt)

	db.Close()
	db, err = sql.Open("sqlite3", tempFilename+"?_loc="+zone)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}

	row = db.QueryRow("select * from foo")
	err = row.Scan(&d)
	if err != nil {
		t.Fatal("Failed to scan datetime:", err)
	}
	if d.Hour() != 15 || !strings.Contains(d.String(), "JST") {
		t.Fatalf("Result should have timezone %v %v", zone, d.String())
	}
}

func TestVersion(t *testing.T) {
	s, n, id := Version()
	if s == "" || n == 0 || id == "" {
		t.Errorf("Version failed %q, %d, %q\n", s, n, id)
	}
}

func TestNumberNamedParams(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec(`
	create table foo (id integer, name text, extra text);
	`)
	if err != nil {
		t.Error("Failed to call db.Query:", err)
	}

	_, err = db.Exec(`insert into foo(id, name, extra) values($1, $2, $2)`, 1, "foo")
	if err != nil {
		t.Error("Failed to call db.Exec:", err)
	}

	row := db.QueryRow(`select id, extra from foo where id = $1 and extra = $2`, 1, "foo")
	if row == nil {
		t.Error("Failed to call db.QueryRow")
	}
	var id int
	var extra string
	err = row.Scan(&id, &extra)
	if err != nil {
		t.Error("Failed to db.Scan:", err)
	}
	if id != 1 || extra != "foo" {
		t.Error("Failed to db.QueryRow: not matched results")
	}
}
