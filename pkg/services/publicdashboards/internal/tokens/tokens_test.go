package tokens

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateAccessToken(t *testing.T) {
	accessToken, err := GenerateAccessToken()

	t.Run("length", func(t *testing.T) {
		require.NoError(t, err)
		assert.Equal(t, 32, len(accessToken))
	})

	t.Run("no - ", func(t *testing.T) {
		assert.False(t, strings.Contains("-", accessToken))
	})
}

func TestValidAccessToken(t *testing.T) {
	t.Run("true", func(t *testing.T) {
		uuid, _ := GenerateAccessToken()
		assert.True(t, IsValidAccessToken(uuid))
	})

	t.Run("false when blank", func(t *testing.T) {
		assert.False(t, IsValidAccessToken(""))
	})

	t.Run("false when can't be parsed by uuid lib", func(t *testing.T) {
		// too long
		assert.False(t, IsValidAccessToken("0123456789012345678901234567890123456789"))
	})
}

// we just check base cases since this wraps utils.IsValidShortUID which has
// test coverage
func TestValidUid(t *testing.T) {
	t.Run("true", func(t *testing.T) {
		assert.True(t, IsValidShortUID("afqrz7jZZ"))
	})

	t.Run("false when blank", func(t *testing.T) {
		assert.False(t, IsValidShortUID(""))
	})

	t.Run("false when invalid chars", func(t *testing.T) {
		assert.False(t, IsValidShortUID("afqrz7j%%"))
	})
}
