package cipher

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_KeyToBytes(t *testing.T) {
	t.Run("with regular secret", func(t *testing.T) {
		key, err := KeyToBytes([]byte("secret"), []byte("salt"))
		require.NoError(t, err)
		assert.Len(t, key, 32)
	})

	t.Run("with very long secret", func(t *testing.T) {
		key, err := KeyToBytes([]byte("a very long secret key that is larger then 32bytes"), []byte("salt"))
		require.NoError(t, err)
		assert.Len(t, key, 32)
	})
}
