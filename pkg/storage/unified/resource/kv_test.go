package resource

import (
	"context"
	"fmt"
	"testing"

	badger "github.com/dgraph-io/badger/v4"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestBadgerDB(t *testing.T) *badger.DB {
	// Create a temporary directory for the test database
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	return db
}

func TestBadgerKV_Get(t *testing.T) {
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	ctx := context.Background()

	// Setup test data
	err := db.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte("section/key1"), []byte("value1"))
	})
	require.NoError(t, err)

	t.Run("Get existing key", func(t *testing.T) {
		obj, err := kv.Get(ctx, "section", "key1")
		require.NoError(t, err)
		assert.Equal(t, "key1", obj.Key)
		assert.Equal(t, []byte("value1"), obj.Value)
	})

	t.Run("Get non-existent key", func(t *testing.T) {
		_, err := kv.Get(ctx, "section", "nonexistent")
		assert.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})
}

func TestBadgerKV_Save(t *testing.T) {
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	ctx := context.Background()

	t.Run("Save new key", func(t *testing.T) {
		err := kv.Save(ctx, "section", "key1", []byte("value1"))
		require.NoError(t, err)

		// Verify the value was saved
		obj, err := kv.Get(ctx, "section", "key1")
		require.NoError(t, err)
		assert.Equal(t, "key1", obj.Key)
		assert.Equal(t, []byte("value1"), obj.Value)
	})

	t.Run("Save overwrite existing key", func(t *testing.T) {
		// First save
		err := kv.Save(ctx, "section", "key1", []byte("oldvalue"))
		require.NoError(t, err)

		// Overwrite
		err = kv.Save(ctx, "section", "key1", []byte("newvalue"))
		require.NoError(t, err)

		// Verify the value was updated
		obj, err := kv.Get(ctx, "section", "key1")
		require.NoError(t, err)
		assert.Equal(t, "key1", obj.Key)
		assert.Equal(t, []byte("newvalue"), obj.Value)
	})
}

func TestBadgerKV_Delete(t *testing.T) {
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	ctx := context.Background()

	t.Run("Delete existing key", func(t *testing.T) {
		// First create a key
		err := kv.Save(ctx, "section", "key1", []byte("value1"))
		require.NoError(t, err)

		// Delete it
		err = kv.Delete(ctx, "section", "key1")
		require.NoError(t, err)

		// Verify it's gone
		_, err = kv.Get(ctx, "section", "key1")
		assert.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("Delete non-existent key", func(t *testing.T) {
		err := kv.Delete(ctx, "section", "nonexistent")
		require.NoError(t, err) // Badger doesn't return error for non-existent keys
	})
}

func TestBadgerKV_Keys(t *testing.T) {
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	ctx := context.Background()

	// Setup test data
	keys := []string{"a1", "a2", "b1", "b2", "c1"}
	for _, k := range keys {
		kv.Save(ctx, "section", k, []byte("value"+k))
	}

	t.Run("Keys", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2", "b1", "b2", "c1"}, keys)
	})

	t.Run("Keys with limit", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{Limit: 2}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2"}, keys)
	})

	t.Run("Keys with range", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{StartKey: "a", EndKey: "b"}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2"}, keys)
	})

	t.Run("Keys with prefix", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{StartKey: "a", EndKey: PrefixRangeEnd("a")}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2"}, keys)
	})

	t.Run("Keys in descending order", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{Sort: SortOrderDesc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"c1", "b2", "b1", "a2", "a1"}, keys)
	})

	t.Run("Keys in descending order with prefix", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, "section", ListOptions{StartKey: "a", EndKey: PrefixRangeEnd("a"), Sort: SortOrderDesc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a2", "a1"}, keys)
	})
}

func TestBadgerKV_Concurrent(t *testing.T) {
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	ctx := context.Background()

	t.Run("Concurrent operations", func(t *testing.T) {
		const numGoroutines = 10
		done := make(chan struct{})

		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				defer func() { done <- struct{}{} }()

				key := fmt.Sprintf("key%d", i)
				value := []byte(fmt.Sprintf("value%d", i))

				// Save
				err := kv.Save(ctx, "section", key, value)
				require.NoError(t, err)

				// Get
				obj, err := kv.Get(ctx, "section", key)
				require.NoError(t, err)
				assert.Equal(t, key, obj.Key)
				assert.Equal(t, value, obj.Value)

				// Delete
				err = kv.Delete(ctx, "section", key)
				require.NoError(t, err)

				// Verify deleted
				_, err = kv.Get(ctx, "section", key)
				assert.Error(t, err)
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			<-done
		}
	})
}
