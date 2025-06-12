package resource

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestRvFromUID(t *testing.T) {

	t.Run("uuid v7", func(t *testing.T) {
		uuidV7, err := uuid.NewV7()
		require.NoError(t, err)
		rv, err := rvFromUID(uuidV7)
		require.NoError(t, err)
		require.NotZero(t, rv)
	})

	t.Run("should be a microsecond unix timestamp", func(t *testing.T) {
		uuidV7, err := uuid.NewV7()
		require.NoError(t, err)
		rv, err := rvFromUID(uuidV7)
		require.NoError(t, err)
		now := time.Now().UnixMicro()
		require.InDelta(t, now, rv, 10000) // 10ms
	})

	t.Run("uuid v4", func(t *testing.T) {
		uuidV4 := uuid.New()
		require.NotEqual(t, 7, uuidV4.Version())
		_, err := rvFromUID(uuidV4)
		require.Error(t, err)
	})
}
