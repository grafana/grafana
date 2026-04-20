package graphite

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
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
