//go:build !cgo

package sqlite

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

type Driver = sqlite.Driver

// The errors below are used in tests to simulate specific SQLite errors. It's a temporary solution
// until we rewrite the tests not to depend on the sqlite3 package internals directly.
// Note: Since modernc.org/sqlite driver does not expose error codes like sqlite3, we cannot use the same approach.
var (
	TestErrUniqueConstraintViolation = errors.New("unique constraint violation (simulated)")
	TestErrBusy                      = errors.New("database is busy (simulated)")
	TestErrLocked                    = errors.New("database is locked (simulated)")
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

// moderncDriver is a wrapper for modernc.org/sqlite driver to convert DSN.
type moderncDriver struct {
	sql.Driver
}

// Open converts a dsn from sqlite3 to modernc.org/sqlite format and opens a connection.
func (d *moderncDriver) Open(name string) (driver.Conn, error) {
	convertedName, err := convertSQLite3URL(name)
	if err != nil {
		return nil, err
	}
	return d.Driver.Open(convertedName)
}

func init() {
	sql.Register("sqlite3", &moderncDriver{Driver: &Driver{}})
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
