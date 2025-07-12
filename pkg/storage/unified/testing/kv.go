package test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Test names for the KV test suite
const (
	TestKVGet            = "get operations"
	TestKVSave           = "save operations"
	TestKVDelete         = "delete operations"
	TestKVKeys           = "keys listing"
	TestKVKeysWithLimits = "keys with limits and ranges"
	TestKVKeysWithSort   = "keys with sorting"
	TestKVConcurrent     = "concurrent operations"
	TestKVUnixTimestamp  = "unix timestamp"
)

// NewKVFunc is a function that creates a new KV instance for testing
type NewKVFunc func(ctx context.Context) resource.KV

// KVTestOptions configures which tests to run
type KVTestOptions struct {
	NSPrefix string // namespace prefix for isolation
}

// GenerateRandomKVPrefix creates a random namespace prefix for test isolation
func GenerateRandomKVPrefix() string {
	return fmt.Sprintf("kvtest-%d", time.Now().UnixNano())
}

// RunKVTest runs the KV test suite
func RunKVTest(t *testing.T, newKV NewKVFunc, opts *KVTestOptions) {
	if opts == nil {
		opts = &KVTestOptions{}
	}

	if opts.NSPrefix == "" {
		opts.NSPrefix = GenerateRandomKVPrefix()
	}

	t.Logf("Running KV tests with namespace prefix: %s", opts.NSPrefix)

	cases := []struct {
		name string
		fn   func(*testing.T, resource.KV, string)
	}{
		{TestKVGet, runTestKVGet},
		{TestKVSave, runTestKVSave},
		{TestKVDelete, runTestKVDelete},
		{TestKVKeys, runTestKVKeys},
		{TestKVKeysWithLimits, runTestKVKeysWithLimits},
		{TestKVKeysWithSort, runTestKVKeysWithSort},
		{TestKVConcurrent, runTestKVConcurrent},
		{TestKVUnixTimestamp, runTestKVUnixTimestamp},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.fn(t, newKV(context.Background()), opts.NSPrefix)
		})
	}
}

func runTestKVGet(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-get"

	t.Run("get existing key", func(t *testing.T) {
		// First save a key
		testValue := "test value for get"
		saveKVHelper(t, kv, ctx, section, "existing-key", strings.NewReader(testValue))

		// Now get it
		reader, err := kv.Get(ctx, section, "existing-key")
		require.NoError(t, err)

		// Read the value
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, testValue, string(value))

		// Close the value reader
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("get non-existent key", func(t *testing.T) {
		_, err := kv.Get(ctx, section, "non-existent-key")
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("get with empty section", func(t *testing.T) {
		_, err := kv.Get(ctx, "", "some-key")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})
}

func runTestKVSave(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-save"

	t.Run("save new key", func(t *testing.T) {
		testValue := "new test value"
		saveKVHelper(t, kv, ctx, section, "new-key", strings.NewReader(testValue))

		// Verify it was saved
		reader, err := kv.Get(ctx, section, "new-key")
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, testValue, string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save overwrite existing key", func(t *testing.T) {
		// First save
		saveKVHelper(t, kv, ctx, section, "overwrite-key", strings.NewReader("old value"))

		// Overwrite
		newValue := "new value"
		saveKVHelper(t, kv, ctx, section, "overwrite-key", strings.NewReader(newValue))

		// Verify it was updated
		reader, err := kv.Get(ctx, section, "overwrite-key")
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, newValue, string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save with empty section", func(t *testing.T) {
		_, err := kv.Save(ctx, "", "some-key")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})

	t.Run("save binary data", func(t *testing.T) {
		binaryData := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}
		saveKVHelper(t, kv, ctx, section, "binary-key", bytes.NewReader(binaryData))

		// Verify binary data
		reader, err := kv.Get(ctx, section, "binary-key")
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, binaryData, value)
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save key with no data", func(t *testing.T) {
		// Save a key with empty data
		saveKVHelper(t, kv, ctx, section, "empty-key", strings.NewReader(""))

		// Verify it was saved with empty data
		reader, err := kv.Get(ctx, section, "empty-key")
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "", string(value))
		assert.Len(t, value, 0)
		err = reader.Close()
		require.NoError(t, err)
	})
}

func runTestKVDelete(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-delete"

	t.Run("delete existing key", func(t *testing.T) {
		// First create a key
		saveKVHelper(t, kv, ctx, section, "delete-key", strings.NewReader("delete me"))

		// Verify it exists
		_, err := kv.Get(ctx, section, "delete-key")
		require.NoError(t, err)

		// Delete it
		err = kv.Delete(ctx, section, "delete-key")
		require.NoError(t, err)

		// Verify it's gone
		_, err = kv.Get(ctx, section, "delete-key")
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("delete non-existent key", func(t *testing.T) {
		err := kv.Delete(ctx, section, "non-existent-delete-key")
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("delete with empty section", func(t *testing.T) {
		err := kv.Delete(ctx, "", "some-key")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})
}

func runTestKVKeys(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-keys"

	// Setup test data
	testKeys := []string{"a1", "a2", "b1", "b2", "c1"}
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, section, key, strings.NewReader("value"+key))
	}

	t.Run("list all keys", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, testKeys, keys)
	})

	t.Run("list keys with empty section", func(t *testing.T) {
		var keys []string
		var errors []error
		for k, err := range kv.Keys(ctx, "", resource.ListOptions{}) {
			if err != nil {
				errors = append(errors, err)
				break
			}
			keys = append(keys, k)
		}
		assert.Len(t, errors, 1)
		assert.Contains(t, errors[0].Error(), "section is required")
		assert.Empty(t, keys)
	})

	t.Run("list keys returns 0 keys", func(t *testing.T) {
		// Use a different section with no keys
		emptySection := nsPrefix + "-empty-keys"

		var keys []string
		for k, err := range kv.Keys(ctx, emptySection, resource.ListOptions{}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Empty(t, keys)
		assert.Len(t, keys, 0)
	})
}

func runTestKVKeysWithLimits(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-keys-limits"

	// Setup test data
	testKeys := []string{"a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"}
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, section, key, strings.NewReader("value"+key))
	}

	t.Run("keys with limit", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{Limit: 3}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2", "b1"}, keys)
	})

	t.Run("keys with range", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{StartKey: "b", EndKey: "d"}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"b1", "b2", "c1", "c2"}, keys)
	})

	t.Run("keys with prefix", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{
			StartKey: "c",
			EndKey:   resource.PrefixRangeEnd("c"),
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"c1", "c2"}, keys)
	})

	t.Run("keys with limit and range", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{
			StartKey: "a",
			EndKey:   "c",
			Limit:    2,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2"}, keys)
	})
}

func runTestKVKeysWithSort(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-keys-sort"

	// Setup test data
	testKeys := []string{"a1", "a2", "b1", "b2", "c1"}
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, section, key, strings.NewReader("value"+key))
	}

	t.Run("keys in ascending order (default)", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{Sort: resource.SortOrderAsc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a1", "a2", "b1", "b2", "c1"}, keys)
	})

	t.Run("keys in descending order", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{Sort: resource.SortOrderDesc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"c1", "b2", "b1", "a2", "a1"}, keys)
	})

	t.Run("keys descending with prefix", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{
			StartKey: "a",
			EndKey:   resource.PrefixRangeEnd("a"),
			Sort:     resource.SortOrderDesc,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"a2", "a1"}, keys)
	})

	t.Run("keys descending with limit", func(t *testing.T) {
		var keys []string
		for k, err := range kv.Keys(ctx, section, resource.ListOptions{
			Sort:  resource.SortOrderDesc,
			Limit: 3,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, []string{"c1", "b2", "b1"}, keys)
	})
}

func runTestKVConcurrent(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(60*time.Second))
	section := nsPrefix + "-concurrent"

	t.Run("concurrent save and get operations", func(t *testing.T) {
		const numGoroutines = 10
		const numOperations = 20

		done := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func(goroutineID int) {
				var err error
				defer func() { done <- err }()

				for j := 0; j < numOperations; j++ {
					key := fmt.Sprintf("concurrent-key-%d-%d", goroutineID, j)
					value := fmt.Sprintf("concurrent-value-%d-%d", goroutineID, j)

					// Save
					writer, err := kv.Save(ctx, section, key)
					if err != nil {
						return
					}
					defer func() {
						err := writer.Close()
						require.NoError(t, err)
					}()
					_, err = io.Copy(writer, strings.NewReader(value))
					if err != nil {
						return
					}
					err = writer.Close()
					if err != nil {
						return
					}

					// Get immediately
					reader, err := kv.Get(ctx, section, key)
					if err != nil {
						return
					}

					readValue, err := io.ReadAll(reader)
					require.NoError(t, err)
					err = reader.Close()
					require.NoError(t, err)
					assert.Equal(t, value, string(readValue))
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			err := <-done
			require.NoError(t, err)
		}
	})

	t.Run("concurrent save, delete, and list operations", func(t *testing.T) {
		const numGoroutines = 5
		done := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func(goroutineID int) {
				var err error
				defer func() { done <- err }()

				key := fmt.Sprintf("concurrent-ops-key-%d", goroutineID)
				value := fmt.Sprintf("concurrent-ops-value-%d", goroutineID)

				// Save
				writer, err := kv.Save(ctx, section, key)
				if err != nil {
					return
				}
				defer func() {
					err := writer.Close()
					require.NoError(t, err)
				}()
				_, err = io.Copy(writer, strings.NewReader(value))
				if err != nil {
					return
				}
				err = writer.Close()
				if err != nil {
					return
				}

				// List to verify it exists
				found := false
				for k, err := range kv.Keys(ctx, section, resource.ListOptions{}) {
					if err != nil {
						return
					}
					if k == key {
						found = true
						break
					}
				}
				if !found {
					err = fmt.Errorf("key %s not found in list", key)
					return
				}

				// Delete
				err = kv.Delete(ctx, section, key)
				if err != nil {
					return
				}

				// Verify it's deleted
				_, err = kv.Get(ctx, section, key)
				require.ErrorIs(t, resource.ErrNotFound, err)
				err = nil // Expected error, so clear it
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			err := <-done
			require.NoError(t, err)
		}
	})
}

func runTestKVUnixTimestamp(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	t.Run("unix timestamp returns reasonable value", func(t *testing.T) {
		timestamp, err := kv.UnixTimestamp(ctx)
		require.NoError(t, err)

		now := time.Now().Unix()
		// Allow for some time difference (up to 5 seconds)
		assert.InDelta(t, now, timestamp, 5)
	})

	t.Run("unix timestamp is consistent", func(t *testing.T) {
		timestamp1, err := kv.UnixTimestamp(ctx)
		require.NoError(t, err)

		timestamp2, err := kv.UnixTimestamp(ctx)
		require.NoError(t, err)

		// Should be very close (within 1 second)
		require.InDelta(t, timestamp1, timestamp2, 1)
	})
}

// saveKVHelper is a helper function to save data to KV store using the new WriteCloser interface
func saveKVHelper(t *testing.T, kv resource.KV, ctx context.Context, section, key string, value io.Reader) {
	t.Helper()
	writer, err := kv.Save(ctx, section, key)
	require.NoError(t, err)
	_, err = io.Copy(writer, value)
	require.NoError(t, err)
	err = writer.Close()
	require.NoError(t, err)
}
