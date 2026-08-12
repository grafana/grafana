package shorturls

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateRelativePath(t *testing.T) {
	validPaths := []string{
		"d/TxKARsmGz/new-dashboard?orgId=1",
		"mock/path?test=true",
		"d/abc123/my-dashboard",
		"explore?left=...",
		"alerting/list",
		"connections/datasources",
	}

	for _, p := range validPaths {
		t.Run("valid: "+p, func(t *testing.T) {
			err := ValidateRelativePath(p)
			assert.NoError(t, err)
		})
	}

	t.Run("rejects absolute path starting with /", func(t *testing.T) {
		err := ValidateRelativePath("/absolute/path")
		require.Error(t, err)
		require.True(t, ErrShortURLAbsolutePath.Is(err))
	})

	t.Run("rejects path traversal with ../", func(t *testing.T) {
		err := ValidateRelativePath("path/../etc/passwd")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects path traversal starting with ../", func(t *testing.T) {
		err := ValidateRelativePath("../etc/passwd")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects protocol-relative URL //", func(t *testing.T) {
		err := ValidateRelativePath("//evil.com/path")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects backslash prefix", func(t *testing.T) {
		err := ValidateRelativePath(`\evil.com`)
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects double backslash prefix", func(t *testing.T) {
		err := ValidateRelativePath(`\\evil.com`)
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects http:// URL", func(t *testing.T) {
		err := ValidateRelativePath("http://evil.com")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects https:// URL", func(t *testing.T) {
		err := ValidateRelativePath("https://evil.com/path")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects javascript: scheme", func(t *testing.T) {
		err := ValidateRelativePath("javascript:alert(1)")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects URL with scheme in the middle", func(t *testing.T) {
		err := ValidateRelativePath("foo://bar")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("trims whitespace before validation", func(t *testing.T) {
		err := ValidateRelativePath("  //evil.com  ")
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})

	t.Run("rejects whitespace-padded absolute path", func(t *testing.T) {
		err := ValidateRelativePath("  /absolute  ")
		require.Error(t, err)
		require.True(t, ErrShortURLAbsolutePath.Is(err))
	})

	t.Run("accepts empty string", func(t *testing.T) {
		err := ValidateRelativePath("")
		assert.NoError(t, err)
	})

	t.Run("rejects backslash path traversal", func(t *testing.T) {
		err := ValidateRelativePath(`path..\etc\passwd`)
		require.Error(t, err)
		require.True(t, ErrShortURLInvalidPath.Is(err))
	})
}
