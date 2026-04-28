package resource

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLimitedWriter(t *testing.T) {
	t.Run("writes within limit", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &LimitedWriter{W: &buf, N: 10}

		n, err := lw.Write([]byte("hello"))
		require.NoError(t, err)
		assert.Equal(t, 5, n)
		assert.Equal(t, "hello", buf.String())
		assert.Equal(t, int64(5), lw.N)
	})

	t.Run("writes exactly at limit", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &LimitedWriter{W: &buf, N: 5}

		n, err := lw.Write([]byte("hello"))
		require.NoError(t, err)
		assert.Equal(t, 5, n)
		assert.Equal(t, int64(0), lw.N)
	})

	t.Run("rejects write exceeding limit", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &LimitedWriter{W: &buf, N: 3}

		n, err := lw.Write([]byte("hello"))
		require.ErrorIs(t, err, ErrWriteLimitExceeded)
		assert.Equal(t, 0, n)
		assert.Empty(t, buf.String())
	})

	t.Run("rejects second write after budget exhausted", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &LimitedWriter{W: &buf, N: 5}

		_, err := lw.Write([]byte("hello"))
		require.NoError(t, err)

		n, err := lw.Write([]byte("x"))
		require.ErrorIs(t, err, ErrWriteLimitExceeded)
		assert.Equal(t, 0, n)
	})

	t.Run("multiple writes within limit", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &LimitedWriter{W: &buf, N: 10}

		_, err := lw.Write([]byte("ab"))
		require.NoError(t, err)
		_, err = lw.Write([]byte("cd"))
		require.NoError(t, err)

		assert.Equal(t, "abcd", buf.String())
		assert.Equal(t, int64(6), lw.N)
	})
}
