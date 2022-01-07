package store

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestensureDefine(t *testing.T) {
	t.Run("Should add a define tag if it's missing", func(t *testing.T) {
		content, name := "content without tags", "test"
		content = ensureDefine(name, content)
		require.True(t, strings.HasPrefix(content, "{{"))
		require.True(t, strings.HasSuffix(content, "}}"))
		require.Contains(t, content, "define")
	})
}
