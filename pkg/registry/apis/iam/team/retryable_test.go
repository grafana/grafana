package team

import (
	"errors"
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestIsRetryableTxnError_NilAndUnrelated(t *testing.T) {
	require.False(t, isRetryableTxnError(nil))
	require.False(t, isRetryableTxnError(errors.New("some unrelated error")))
}

func TestIsRetryableTxnError_Structured(t *testing.T) {
	mysqlDeadlock := &mysql.MySQLError{Number: 1213, SQLState: [5]byte{'4', '0', '0', '0', '1'}, Message: "Deadlock found when trying to get lock"}
	mysqlLockWait := &mysql.MySQLError{Number: 1205, SQLState: [5]byte{'H', 'Y', '0', '0', '0'}, Message: "Lock wait timeout exceeded"}
	mysqlSyntax := &mysql.MySQLError{Number: 1064, SQLState: [5]byte{'4', '2', '0', '0', '0'}, Message: "syntax error"}

	pgxDeadlock := &pgconn.PgError{Severity: "ERROR", Code: "40P01", Message: "deadlock detected"}
	pgxSerialization := &pgconn.PgError{Severity: "ERROR", Code: "40001", Message: "could not serialize access due to concurrent update"}
	pgxUnique := &pgconn.PgError{Severity: "ERROR", Code: "23505", Message: "duplicate key value"}

	pqDeadlock := &pq.Error{Severity: "ERROR", Code: "40P01", Message: "deadlock detected"}
	pqSerialization := &pq.Error{Severity: "ERROR", Code: "40001", Message: "could not serialize access due to concurrent update"}
	pqUnique := &pq.Error{Severity: "ERROR", Code: "23505", Message: "duplicate key value"}

	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"mysql 1213 deadlock", mysqlDeadlock, true},
		{"mysql 1205 lock wait", mysqlLockWait, true},
		{"mysql 1064 syntax (not retryable)", mysqlSyntax, false},
		{"pgx 40P01 deadlock", pgxDeadlock, true},
		{"pgx 40001 serialization", pgxSerialization, true},
		{"pgx 23505 unique (not retryable)", pgxUnique, false},
		{"pq 40P01 deadlock", pqDeadlock, true},
		{"pq 40001 serialization", pqSerialization, true},
		{"pq 23505 unique (not retryable)", pqUnique, false},
		{"wrapped mysql deadlock", fmt.Errorf("Exec: %w", mysqlDeadlock), true},
		{"wrapped pgx deadlock", fmt.Errorf("Exec: %w", pgxDeadlock), true},
		{"wrapped pq deadlock", fmt.Errorf("Exec: %w", pqDeadlock), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, isRetryableTxnError(tc.err))
		})
	}
}

// TestIsRetryableTxnError_StringFallback guards against driver-format
// drift. Each retryable driver error must stringify into a substring the
// fallback recognises — so even when the type chain is dropped (as it is
// after unified-storage's AsErrorResult), the predicate still fires.
//
// Constructing errors.New(driverErr.Error()) discards the Go type, mirroring
// what AsErrorResult does on the wire.
func TestIsRetryableTxnError_StringFallback(t *testing.T) {
	cases := []struct {
		name string
		err  error
	}{
		{"mysql 1213", &mysql.MySQLError{Number: 1213, SQLState: [5]byte{'4', '0', '0', '0', '1'}, Message: "Deadlock found when trying to get lock"}},
		{"mysql 1205", &mysql.MySQLError{Number: 1205, SQLState: [5]byte{'H', 'Y', '0', '0', '0'}, Message: "Lock wait timeout exceeded"}},
		{"pgx 40P01", &pgconn.PgError{Severity: "ERROR", Code: "40P01", Message: "deadlock detected"}},
		{"pgx 40001", &pgconn.PgError{Severity: "ERROR", Code: "40001", Message: "could not serialize access due to concurrent update"}},
		{"pq 40P01", &pq.Error{Severity: "ERROR", Code: "40P01", Message: "deadlock detected"}},
		{"pq 40001", &pq.Error{Severity: "ERROR", Code: "40001", Message: "could not serialize access due to concurrent update"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stringified := errors.New(tc.err.Error())
			require.Truef(t, isRetryableTxnError(stringified),
				"driver %q stringified to %q which no fallback substring matches — update isRetryableTxnError or the substring list",
				tc.name, stringified.Error())
		})
	}
}
