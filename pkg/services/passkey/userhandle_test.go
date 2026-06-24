package passkey

import (
	"encoding/binary"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncodeUserHandle(t *testing.T) {
	t.Run("known vector: userID 1 encodes to 8-byte big-endian", func(t *testing.T) {
		got := EncodeUserHandle(1)
		require.Len(t, got, UserHandleLen)
		// userID 1 as big-endian uint64 = [0 0 0 0 0 0 0 1]
		assert.Equal(t, []byte{0, 0, 0, 0, 0, 0, 0, 1}, got)
	})

	t.Run("known vector: userID 256 encodes to [0 0 0 0 0 0 1 0]", func(t *testing.T) {
		got := EncodeUserHandle(256)
		require.Len(t, got, UserHandleLen)
		assert.Equal(t, []byte{0, 0, 0, 0, 0, 0, 1, 0}, got)
	})

	t.Run("always returns UserHandleLen bytes", func(t *testing.T) {
		for _, id := range []int64{0, 1, -1, 1<<32 - 1, 1 << 48} {
			assert.Len(t, EncodeUserHandle(id), UserHandleLen, "userID=%d", id)
		}
	})

	t.Run("round-trips through big-endian uint64", func(t *testing.T) {
		userID := int64(42_000_000)
		b := EncodeUserHandle(userID)
		decoded := int64(binary.BigEndian.Uint64(b))
		assert.Equal(t, userID, decoded)
	})
}
