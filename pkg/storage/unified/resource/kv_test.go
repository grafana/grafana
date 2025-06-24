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
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	return db
}

func TestBadgerKV_Get(t *testing.T) {
	db := setupTestBadgerDB(t)

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

// setupIteratorTestData creates a test environment with common test data
func setupIteratorTestData(t *testing.T) (*badgerKV, context.Context) {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})

	kv := NewBadgerKV(db)
	ctx := context.Background()

	// Setup test data
	keys := []string{"a1", "a2", "b1", "b2", "c1"}
	for _, k := range keys {
		err := kv.Save(ctx, "section", k, []byte("value"+k))
		require.NoError(t, err)
	}

	return kv, ctx
}

// iteratorTestCase represents a test case for iteration methods
type iteratorTestCase struct {
	name         string
	options      ListOptions
	expectedKeys []string
}

// getIteratorTestCases returns common test cases for both Keys and List methods
func getIteratorTestCases() []iteratorTestCase {
	return []iteratorTestCase{
		{
			name:         "all items",
			options:      ListOptions{},
			expectedKeys: []string{"a1", "a2", "b1", "b2", "c1"},
		},
		{
			name:         "with limit",
			options:      ListOptions{Limit: 2},
			expectedKeys: []string{"a1", "a2"},
		},
		{
			name:         "with range",
			options:      ListOptions{StartKey: "a", EndKey: "b"},
			expectedKeys: []string{"a1", "a2"},
		},
		{
			name:         "with prefix",
			options:      ListOptions{StartKey: "a", EndKey: PrefixRangeEnd("a")},
			expectedKeys: []string{"a1", "a2"},
		},
		{
			name:         "in descending order",
			options:      ListOptions{Sort: SortOrderDesc},
			expectedKeys: []string{"c1", "b2", "b1", "a2", "a1"},
		},
		{
			name:         "in descending order with prefix",
			options:      ListOptions{StartKey: "a", EndKey: PrefixRangeEnd("a"), Sort: SortOrderDesc},
			expectedKeys: []string{"a2", "a1"},
		},
	}
}

func TestPrefixRangeEnd(t *testing.T) {
	require.Equal(t, "b", PrefixRangeEnd("a"))
	require.Equal(t, "a/c", PrefixRangeEnd("a/b"))
	require.Equal(t, "a/b/d", PrefixRangeEnd("a/b/c"))
	require.Equal(t, "", PrefixRangeEnd(""))
}

func TestBadgerKV_Keys(t *testing.T) {
	for _, tc := range getIteratorTestCases() {
		t.Run("Keys "+tc.name, func(t *testing.T) {
			kv, ctx := setupIteratorTestData(t)

			var keys []string
			for k, err := range kv.Keys(ctx, "section", tc.options) {
				require.NoError(t, err)
				keys = append(keys, k)
			}
			assert.Equal(t, tc.expectedKeys, keys)
		})
	}
}

func TestBadgerKV_List(t *testing.T) {
	for _, tc := range getIteratorTestCases() {
		t.Run("List "+tc.name, func(t *testing.T) {
			kv, ctx := setupIteratorTestData(t)

			var objects []KVObject
			for obj, err := range kv.List(ctx, "section", tc.options) {
				require.NoError(t, err)
				objects = append(objects, obj)
			}

			// Verify we got the expected number of objects
			assert.Len(t, objects, len(tc.expectedKeys))

			// Verify keys and values match expectations
			for i, expectedKey := range tc.expectedKeys {
				assert.Equal(t, expectedKey, objects[i].Key)
				assert.Equal(t, []byte("value"+expectedKey), objects[i].Value)
			}
		})
	}

	// Test edge cases with fresh setup
	t.Run("List empty section", func(t *testing.T) {
		kv, ctx := setupIteratorTestData(t)

		var objects []KVObject
		var errors []error
		for obj, err := range kv.List(ctx, "emptysection", ListOptions{}) {
			if err != nil {
				errors = append(errors, err)
			} else {
				objects = append(objects, obj)
			}
		}
		assert.Len(t, objects, 0)
		assert.Len(t, errors, 0)
	})

	t.Run("List with empty section parameter", func(t *testing.T) {
		kv, ctx := setupIteratorTestData(t)

		var errors []error
		for _, err := range kv.List(ctx, "", ListOptions{}) {
			if err != nil {
				errors = append(errors, err)
				break
			}
		}
		assert.Len(t, errors, 1)
		assert.Contains(t, errors[0].Error(), "section is required")
	})
}

func TestBadgerKV_Concurrent(t *testing.T) {
	db := setupTestBadgerDB(t)

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
