package sqlite

import (
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"
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
