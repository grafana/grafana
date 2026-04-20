package graphite

import (
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTruncateForLog(t *testing.T) {
	t.Run("returns body as-is when under the cap", func(t *testing.T) {
		in := []byte("hello world")
		got := truncateForLog(in)
		assert.Equal(t, "hello world", got)
	})

	t.Run("returns body as-is at exactly the cap", func(t *testing.T) {
		in := bytes.Repeat([]byte("a"), logBodyMaxBytes)
		got := truncateForLog(in)
		assert.Equal(t, logBodyMaxBytes, len(got))
		assert.False(t, strings.HasSuffix(got, "[truncated]"))
	})

	t.Run("truncates and marks oversized bodies", func(t *testing.T) {
		in := bytes.Repeat([]byte("a"), logBodyMaxBytes+100)
		got := truncateForLog(in)
		assert.True(t, strings.HasSuffix(got, "...[truncated]"))
		assert.Equal(t, logBodyMaxBytes+len("...[truncated]"), len(got))
	})
}

func TestDecode(t *testing.T) {
	t.Run("plain body under cap succeeds", func(t *testing.T) {
		payload := []byte(`{"ok":true}`)
		got, err := decode("", io.NopCloser(bytes.NewReader(payload)), 1<<20)
		require.NoError(t, err)
		assert.Equal(t, payload, got)
	})

	t.Run("plain body exactly at cap succeeds", func(t *testing.T) {
		payload := bytes.Repeat([]byte("x"), 1024)
		got, err := decode("", io.NopCloser(bytes.NewReader(payload)), 1024)
		require.NoError(t, err)
		assert.Equal(t, 1024, len(got))
	})

	t.Run("plain body over cap returns errResponseBodyTooLarge", func(t *testing.T) {
		payload := bytes.Repeat([]byte("x"), 2048)
		_, err := decode("", io.NopCloser(bytes.NewReader(payload)), 1024)
		require.Error(t, err)
		assert.True(t, errors.Is(err, errResponseBodyTooLarge))
	})

	t.Run("maxBytes <= 0 disables the cap", func(t *testing.T) {
		payload := bytes.Repeat([]byte("x"), 2048)
		got, err := decode("", io.NopCloser(bytes.NewReader(payload)), 0)
		require.NoError(t, err)
		assert.Equal(t, 2048, len(got))
	})

	t.Run("gzip body over cap returns errResponseBodyTooLarge", func(t *testing.T) {
		// Zip-bomb style input: small wire size, large decoded size.
		// Verifies the cap applies post-decompression.
		var buf bytes.Buffer
		gw := gzip.NewWriter(&buf)
		_, err := gw.Write(bytes.Repeat([]byte("x"), 8192))
		require.NoError(t, err)
		require.NoError(t, gw.Close())

		_, err = decode("gzip", io.NopCloser(&buf), 1024)
		require.Error(t, err)
		assert.True(t, errors.Is(err, errResponseBodyTooLarge))
	})
}
