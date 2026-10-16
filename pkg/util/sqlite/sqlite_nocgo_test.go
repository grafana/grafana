package sqlite

import (
	"database/sql"
	"net/url"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestAppliesConvertedPragmas(t *testing.T) {
	dsn := "file:" + filepath.Join(t.TempDir(), "test.db") + "?_journal_mode=WAL&_synchronous=OFF&_cache_size=2000&_temp_store=MEMORY"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open SQLite database: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("close SQLite database: %v", err)
		}
	})

	conn, err := db.Conn(t.Context())
	if err != nil {
		t.Fatalf("open SQLite connection: %v", err)
	}
	t.Cleanup(func() {
		if err := conn.Close(); err != nil {
			t.Errorf("close SQLite connection: %v", err)
		}
	})

	testCases := []struct {
		pragma string
		want   any
	}{
		{pragma: "busy_timeout", want: int64(7500)},
		{pragma: "cache_size", want: int64(2000)},
		{pragma: "journal_mode", want: "wal"},
		{pragma: "synchronous", want: int64(0)},
		{pragma: "temp_store", want: int64(2)},
	}
	for _, tc := range testCases {
		var got any
		if err := conn.QueryRowContext(t.Context(), "PRAGMA "+tc.pragma).Scan(&got); err != nil {
			t.Fatalf("query PRAGMA %s: %v", tc.pragma, err)
		}
		if !reflect.DeepEqual(got, tc.want) {
			t.Errorf("unexpected PRAGMA %s: got %#v, want %#v", tc.pragma, got, tc.want)
		}
	}
}

// TestStableTimeFormat verifies that a time.Time passed directly to Exec is stored in a stable
// format, without a monotonic reading or a duplicated zone offset (see issue #129518).
func TestStableTimeFormat(t *testing.T) {
	// A location with a numeric zone name is what triggered the duplicated-offset representation.
	loc := time.FixedZone("+0330", 3*3600+30*60)

	for _, dsn := range []string{
		"file:" + filepath.Join(t.TempDir(), "test.db") + "?_journal_mode=WAL",
		"file:" + filepath.Join(t.TempDir(), "noparams.db"),
	} {
		t.Run(dsn, func(t *testing.T) {
			db, err := sql.Open("sqlite3", dsn)
			if err != nil {
				t.Fatalf("open SQLite database: %v", err)
			}
			t.Cleanup(func() {
				if err := db.Close(); err != nil {
					t.Errorf("close SQLite database: %v", err)
				}
			})

			if _, err := db.ExecContext(t.Context(), "CREATE TABLE t (ts TEXT)"); err != nil {
				t.Fatalf("create table: %v", err)
			}

			now := time.Now().In(loc)
			if _, err := db.ExecContext(t.Context(), "INSERT INTO t (ts) VALUES (?)", now); err != nil {
				t.Fatalf("insert time: %v", err)
			}

			var stored string
			if err := db.QueryRowContext(t.Context(), "SELECT ts FROM t").Scan(&stored); err != nil {
				t.Fatalf("select time: %v", err)
			}

			if strings.Contains(stored, "m=") {
				t.Errorf("stored time contains monotonic reading: %q", stored)
			}
			if strings.Count(stored, "+0330") > 1 {
				t.Errorf("stored time contains duplicated zone offset: %q", stored)
			}

			// The stored value must round-trip back to the original instant.
			parsed, err := time.Parse("2006-01-02 15:04:05.999999999-07:00", stored)
			if err != nil {
				t.Fatalf("parse stored time %q: %v", stored, err)
			}
			if !parsed.Equal(now) {
				t.Errorf("stored time %q does not match original %q", parsed, now)
			}
		})
	}
}

func TestConvertSQLite3URL_TimeFormat(t *testing.T) {
	testCases := []struct {
		name string
		dsn  string
		want string
	}{
		{
			name: "default is applied when absent",
			dsn:  "file:test.db?_journal_mode=WAL",
			want: "sqlite",
		},
		{
			name: "default is applied without params",
			dsn:  "file:test.db",
			want: "sqlite",
		},
		{
			name: "user configuration takes precedence",
			dsn:  "file:test.db?_time_format=datetime",
			want: "datetime",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			converted, err := convertSQLite3URL(tc.dsn)
			if err != nil {
				t.Fatalf("convertSQLite3URL: %v", err)
			}
			pos := strings.IndexRune(converted, '?')
			if pos < 0 {
				t.Fatalf("converted DSN has no query params: %q", converted)
			}
			q, err := url.ParseQuery(converted[pos+1:])
			if err != nil {
				t.Fatalf("parse converted query: %v", err)
			}
			if got := q.Get("_time_format"); got != tc.want {
				t.Errorf("unexpected _time_format: got %q, want %q", got, tc.want)
			}
		})
	}
}
