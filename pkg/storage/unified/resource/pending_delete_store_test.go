package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPendingDeleteStore_IsPendingDelete(t *testing.T) {
	t.Run("no record returns false", func(t *testing.T) {
		store := NewPendingDeleteStore(setupBadgerKV(t))

		pending, err := store.IsPendingDelete(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.False(t, pending)
	})

	t.Run("record returns true", func(t *testing.T) {
		store := NewPendingDeleteStore(setupBadgerKV(t))
		require.NoError(t, store.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter: "2026-03-01T00:00:00Z",
		}))

		pending, err := store.IsPendingDelete(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, pending)
	})

	t.Run("already-deleted record still returns true", func(t *testing.T) {
		store := NewPendingDeleteStore(setupBadgerKV(t))
		require.NoError(t, store.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter: "2026-03-01T00:00:00Z",
			DeletedAt:   "2026-03-02T00:00:00Z",
		}))

		pending, err := store.IsPendingDelete(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, pending)
	})
}
