package metadata

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestIsTransientTransactionError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil", err: nil, want: false},
		{name: "unrelated", err: errors.New("unrelated"), want: false},
		{name: "mysql deadlock", err: &mysql.MySQLError{Number: 1213}, want: true},
		{name: "mysql lock timeout", err: &mysql.MySQLError{Number: 1205}, want: true},
		{name: "wrapped mysql deadlock", err: fmt.Errorf("wrapped: %w", &mysql.MySQLError{Number: 1213}), want: true},
		{name: "pgx deadlock", err: &pgconn.PgError{Code: "40P01"}, want: true},
		{name: "pgx serialization", err: &pgconn.PgError{Code: "40001"}, want: true},
		{name: "pq deadlock", err: &pq.Error{Code: "40P01"}, want: true},
		{name: "pq serialization", err: &pq.Error{Code: "40001"}, want: true},
		{name: "stringified mysql deadlock", err: errors.New("Error 1213 (40001): Deadlock found when trying to get lock"), want: true},
		{name: "stringified postgres serialization", err: errors.New("SQLSTATE 40001"), want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tt.want, isTransientTransactionError(tt.err))
		})
	}
}

func TestRetryTransientTransaction(t *testing.T) {
	t.Run("retries a transient error until success", func(t *testing.T) {
		attempts := 0
		err := retryTransientTransaction(t.Context(), func() error {
			attempts++
			if attempts < 3 {
				return &mysql.MySQLError{Number: 1213}
			}
			return nil
		})

		require.NoError(t, err)
		require.Equal(t, 3, attempts)
	})

	t.Run("does not retry a permanent error", func(t *testing.T) {
		attempts := 0
		permanentErr := errors.New("permanent")
		err := retryTransientTransaction(t.Context(), func() error {
			attempts++
			return permanentErr
		})

		require.ErrorIs(t, err, permanentErr)
		require.Equal(t, 1, attempts)
	})

	t.Run("stops after the maximum attempts", func(t *testing.T) {
		attempts := 0
		deadlockErr := &mysql.MySQLError{Number: 1213}
		err := retryTransientTransaction(t.Context(), func() error {
			attempts++
			return deadlockErr
		})

		require.ErrorIs(t, err, deadlockErr)
		require.Equal(t, transientTransactionBackoff.MaxRetries+1, attempts)
	})

	t.Run("honors context cancellation while waiting", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		attempts := 0
		err := retryTransientTransaction(ctx, func() error {
			attempts++
			cancel()
			return &mysql.MySQLError{Number: 1213}
		})

		require.ErrorIs(t, err, context.Canceled)
		require.Equal(t, 1, attempts)
	})
}
