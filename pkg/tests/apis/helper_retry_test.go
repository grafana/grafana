package apis

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsTransientLockError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil", err: nil, want: false},
		{name: "unrelated", err: errors.New("forbidden"), want: false},
		{name: "sqlite busy", err: errors.New(`deleting role "x": database is locked (5) (SQLITE_BUSY)`), want: true},
		{name: "table locked", err: errors.New("database table is locked"), want: true},
		{name: "wrapped busy code", err: errors.New("internal error: SQLITE_BUSY"), want: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, isTransientLockError(tc.err))
		})
	}
}

func TestRetryOnLockError(t *testing.T) {
	t.Run("retries until success", func(t *testing.T) {
		calls := 0
		res, err := retryOnLockError(func() (string, error) {
			calls++
			if calls < 3 {
				return "", errors.New("database is locked (5) (SQLITE_BUSY)")
			}
			return "ok", nil
		})
		require.NoError(t, err)
		assert.Equal(t, "ok", res)
		assert.Equal(t, 3, calls)
	})

	t.Run("does not retry non-lock errors", func(t *testing.T) {
		calls := 0
		_, err := retryOnLockError(func() (string, error) {
			calls++
			return "", errors.New("forbidden")
		})
		require.Error(t, err)
		assert.Equal(t, 1, calls)
	})

	t.Run("gives up after the retry budget", func(t *testing.T) {
		calls := 0
		_, err := retryOnLockError(func() (string, error) {
			calls++
			return "", errors.New("database is locked")
		})
		require.Error(t, err)
		assert.Equal(t, transientLockErrorRetries+1, calls)
	})
}
