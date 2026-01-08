package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContinueToken(t *testing.T) {
	t.Run("round-trip with namespace (cross-namespace query)", func(t *testing.T) {
		original := ContinueToken{
			Namespace:       "my-namespace",
			Name:            "my-resource",
			ResourceVersion: 200,
		}
		decoded, err := GetContinueToken(original.String())
		require.NoError(t, err)
		assert.Equal(t, original.Namespace, decoded.Namespace)
		assert.Equal(t, original.Name, decoded.Name)
		assert.Equal(t, original.ResourceVersion, decoded.ResourceVersion)
	})

	t.Run("round-trip without namespace (single-namespace query)", func(t *testing.T) {
		original := ContinueToken{
			Name:            "test-resource",
			ResourceVersion: 100,
		}
		decoded, err := GetContinueToken(original.String())
		require.NoError(t, err)
		assert.Equal(t, "", decoded.Namespace)
		assert.Equal(t, original.Name, decoded.Name)
		assert.Equal(t, original.ResourceVersion, decoded.ResourceVersion)
	})

	t.Run("history token (no name, uses ResourceVersion for pagination)", func(t *testing.T) {
		original := ContinueToken{
			ResourceVersion: 500,
			SortAscending:   true,
		}
		decoded, err := GetContinueToken(original.String())
		require.NoError(t, err)
		assert.Equal(t, "", decoded.Name)
		assert.Equal(t, int64(500), decoded.ResourceVersion)
		assert.True(t, decoded.SortAscending)
	})

	t.Run("rejects invalid base64", func(t *testing.T) {
		_, err := GetContinueToken("not-valid-base64!")
		assert.Error(t, err)
	})

	t.Run("rejects invalid json", func(t *testing.T) {
		_, err := GetContinueToken("bm90LWpzb24=") // "not-json" in base64
		assert.Error(t, err)
	})
}
