package passkeyimpl

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserHandleRoundTrip(t *testing.T) {
	ids := []int64{0, 1, 42, 12345, 1 << 32, math.MaxInt64}
	for _, id := range ids {
		got, err := decodeUserHandle(encodeUserHandle(id))
		require.NoError(t, err)
		require.Equal(t, id, got)
	}
}

func TestEncodeUserHandleIsStableBigEndian(t *testing.T) {
	// Guards the on-the-wire encoding: a change here would orphan every enrolled credential.
	require.Equal(t, []byte{0, 0, 0, 0, 0, 0, 0, 1}, encodeUserHandle(1))
	require.Len(t, encodeUserHandle(math.MaxInt64), userHandleLen)
}

func TestDecodeUserHandleRejectsWrongLength(t *testing.T) {
	for _, b := range [][]byte{nil, {}, {0, 0, 0, 1}, make([]byte, 9)} {
		_, err := decodeUserHandle(b)
		require.Error(t, err)
	}
}
