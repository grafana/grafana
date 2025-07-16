package resource

import (
	"context"
	"io"
	"strings"
	"testing"

	badger "github.com/dgraph-io/badger/v4"

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

func setupTestKV(t *testing.T) KV {
	db := setupTestBadgerDB(t)
	return NewBadgerKV(db)
}

func TestPrefixRangeEnd(t *testing.T) {
	require.Equal(t, "b", PrefixRangeEnd("a"))
	require.Equal(t, "a/c", PrefixRangeEnd("a/b"))
	require.Equal(t, "a/b/d", PrefixRangeEnd("a/b/c"))
	require.Equal(t, "", PrefixRangeEnd(""))
}

func TestBadgerKVSmoke(t *testing.T) {
	// Simple smoke test to ensure the basic badger KV implementation works
	kv := setupTestKV(t)
	ctx := context.Background()

	// Test unix timestamp works
	timestamp, err := kv.UnixTimestamp(ctx)
	require.NoError(t, err)
	require.Greater(t, timestamp, int64(0))

	// Test get non-existent key returns proper error
	_, err = kv.Get(ctx, "test-section", "non-existent")
	require.Error(t, err)
	require.Equal(t, ErrNotFound, err)
}

func TestBadgerKV_UnderlyingStorage(t *testing.T) {
	// Test internal key storage format and structure
	db := setupTestBadgerDB(t)
	kv := NewBadgerKV(db)
	ctx := context.Background()

	t.Run("keys are stored with section prefix", func(t *testing.T) {
		section := "test-section"
		key := "test-key"
		value := "test-value"
		expectedInternalKey := section + "/" + key

		// Save through KV interface
		saveKVHelper(t, kv, ctx, section, key, strings.NewReader(value))

		// Verify the raw key exists in badger with correct format
		err := db.View(func(txn *badger.Txn) error {
			item, err := txn.Get([]byte(expectedInternalKey))
			require.NoError(t, err)

			// Verify the value is correct
			valueBytes, err := item.ValueCopy(nil)
			require.NoError(t, err)
			require.Equal(t, value, string(valueBytes))

			return nil
		})
		require.NoError(t, err)
	})

	t.Run("sections are properly isolated", func(t *testing.T) {
		section1 := "section1"
		section2 := "section2"
		key := "same-key"
		value1 := "value-from-section1"
		value2 := "value-from-section2"

		// Save same key in different sections
		saveKVHelper(t, kv, ctx, section1, key, strings.NewReader(value1))
		saveKVHelper(t, kv, ctx, section2, key, strings.NewReader(value2))

		// Verify both keys exist in badger with different internal keys
		err := db.View(func(txn *badger.Txn) error {
			// Check section1 key
			item1, err := txn.Get([]byte(section1 + "/" + key))
			require.NoError(t, err)
			value1Bytes, err := item1.ValueCopy(nil)
			require.NoError(t, err)
			require.Equal(t, value1, string(value1Bytes))

			// Check section2 key
			item2, err := txn.Get([]byte(section2 + "/" + key))
			require.NoError(t, err)
			value2Bytes, err := item2.ValueCopy(nil)
			require.NoError(t, err)
			require.Equal(t, value2, string(value2Bytes))

			return nil
		})
		require.NoError(t, err)

		// Verify KV interface returns correct values for each section
		reader1, err := kv.Get(ctx, section1, key)
		require.NoError(t, err)
		val1, err := io.ReadAll(reader1)
		require.NoError(t, err)
		require.Equal(t, value1, string(val1))
		err = reader1.Close()
		require.NoError(t, err)

		reader2, err := kv.Get(ctx, section2, key)
		require.NoError(t, err)
		val2, err := io.ReadAll(reader2)
		require.NoError(t, err)
		require.Equal(t, value2, string(val2))
		err = reader2.Close()
		require.NoError(t, err)
	})

	t.Run("delete removes correct internal key", func(t *testing.T) {
		section := "delete-section"
		key := "delete-key"
		value := "delete-value"
		internalKey := section + "/" + key

		// Save and verify it exists
		saveKVHelper(t, kv, ctx, section, key, strings.NewReader(value))

		// Verify it exists in badger
		err := db.View(func(txn *badger.Txn) error {
			_, err := txn.Get([]byte(internalKey))
			return err
		})
		require.NoError(t, err)

		// Delete through KV interface
		err = kv.Delete(ctx, section, key)
		require.NoError(t, err)

		// Verify it's gone from badger
		err = db.View(func(txn *badger.Txn) error {
			_, err := txn.Get([]byte(internalKey))
			return err
		})
		require.Error(t, err)
		require.Equal(t, badger.ErrKeyNotFound, err)
	})

	t.Run("keys iteration respects section boundaries", func(t *testing.T) {
		section1 := "alpha"
		section2 := "beta"

		// Add keys to both sections
		keys1 := []string{"a1", "a2", "a3"}
		keys2 := []string{"b1", "b2", "b3"}

		for _, k := range keys1 {
			saveKVHelper(t, kv, ctx, section1, k, strings.NewReader("value"+k))
		}
		for _, k := range keys2 {
			saveKVHelper(t, kv, ctx, section2, k, strings.NewReader("value"+k))
		}

		// List keys from section1 only
		var foundKeys1 []string
		for k, err := range kv.Keys(ctx, section1, ListOptions{}) {
			require.NoError(t, err)
			foundKeys1 = append(foundKeys1, k)
		}
		require.Equal(t, keys1, foundKeys1)

		// List keys from section2 only
		var foundKeys2 []string
		for k, err := range kv.Keys(ctx, section2, ListOptions{}) {
			require.NoError(t, err)
			foundKeys2 = append(foundKeys2, k)
		}
		require.Equal(t, keys2, foundKeys2)

		// Verify raw badger contains all keys with proper prefixes
		var allRawKeys []string
		err := db.View(func(txn *badger.Txn) error {
			opts := badger.DefaultIteratorOptions
			opts.PrefetchValues = false
			iter := txn.NewIterator(opts)
			defer iter.Close()

			for iter.Rewind(); iter.Valid(); iter.Next() {
				item := iter.Item()
				allRawKeys = append(allRawKeys, string(item.Key()))
			}
			return nil
		})
		require.NoError(t, err)

		// Check that all expected internal keys exist
		expectedInternalKeys := []string{
			"alpha/a1", "alpha/a2", "alpha/a3",
			"beta/b1", "beta/b2", "beta/b3",
		}
		for _, expectedKey := range expectedInternalKeys {
			require.Contains(t, allRawKeys, expectedKey, "Expected internal key %s should exist", expectedKey)
		}
	})
}

func TestIsValidKey(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		expected bool
	}{
		// Valid keys
		{"simple key", "a", true},
		{"key with numbers", "a123", true},
		{"key with hyphens", "a-b-c", true},
		{"key with dots", "a.b.c", true},
		{"key with mixed", "a1-b2.c3", true},
		{"composite key with slash", "ns/group", true},
		{"composite key with tilde", "ns~action", true},
		{"complex composite key", "ns/group/resource/name", true},
		{"data key format", "ns/group/resource/name/123~created", true},
		{"metadata key format", "group/resource/ns/name/123~created~folder", true},
		{"metadata key format ending with a ~", "group/resource/ns/name/123~created~", true},

		// invalid keys
		{"empty key", "", false},
		{"uppercase letters", "Invalid", false},
		{"special characters", "a@b", false},
		{"spaces", "a b", false},
		{"leading space", " key", false},
		{"trailing space", "key ", false},
		{"tab character", "a\tb", false},
		{"newline character", "a\nb", false},
		{"underscores", "a_b", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidKey(tt.key)
			require.Equal(t, tt.expected, result,
				"IsValidKey(%q) = %v, expected %v", tt.key, result, tt.expected)
		})
	}
}

// saveKVHelper is a helper function to save data to KV store using the new WriteCloser interface
func saveKVHelper(t *testing.T, kv KV, ctx context.Context, section, key string, value io.Reader) {
	t.Helper()
	writer, err := kv.Save(ctx, section, key)
	require.NoError(t, err)
	_, err = io.Copy(writer, value)
	require.NoError(t, err)
	err = writer.Close()
	require.NoError(t, err)
}
