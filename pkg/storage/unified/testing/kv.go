package test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
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
	TestKVBatchGet       = "batch get operations"
	TestKVBatchDelete    = "batch delete operations"
	TestKVBatch          = "batch operations"

	// Use `eventsSection` as the section for the tests, as the sqlkv implementation
	// needs a real section to determine which table to use.
	testSection = "unified/events"
)

// NewKVFunc is a function that creates a new KV instance for testing
type NewKVFunc func(ctx context.Context) resource.KV

// KVTestOptions configures which tests to run
type KVTestOptions struct {
	SkipTests map[string]bool
	NSPrefix  string // namespace prefix for isolation
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
		{TestKVBatchGet, runTestKVBatchGet},
		{TestKVBatchDelete, runTestKVBatchDelete},
		{TestKVBatch, runTestKVBatch},
	}

	for _, tc := range cases {
		if shouldSkip := opts.SkipTests[tc.name]; shouldSkip {
			t.Logf("Skipping test: %s", tc.name)
			continue
		}

		t.Run(tc.name, func(t *testing.T) {
			tc.fn(t, newKV(context.Background()), opts.NSPrefix)
		})
	}
}

func namespacedKeys(nsPrefix string, keys []string) []string {
	prefixed := make([]string, 0, len(keys))
	for _, k := range keys {
		prefixed = append(prefixed, nsPrefix+"/"+k)
	}

	return prefixed
}

func namespacedKey(nsPrefix, key string) string {
	return namespacedKeys(nsPrefix, []string{key})[0]
}

func runTestKVGet(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-get"

	t.Run("get existing key", func(t *testing.T) {
		// First save a key
		existingKey := namespacedKey(nsPrefix, "existing-key")
		testValue := "test value for get"
		saveKVHelper(t, kv, ctx, testSection, existingKey, strings.NewReader(testValue))

		// Now get it
		reader, err := kv.Get(ctx, testSection, existingKey)
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
		_, err := kv.Get(ctx, testSection, namespacedKey(nsPrefix, "non-existent-key"))
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("get with empty section", func(t *testing.T) {
		_, err := kv.Get(ctx, "", namespacedKey(nsPrefix, "some-key"))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})

	t.Run("get with empty key", func(t *testing.T) {
		_, err := kv.Get(ctx, testSection, "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "key is required")
	})
}

func runTestKVSave(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-save"

	t.Run("save new key", func(t *testing.T) {
		newKey := namespacedKey(nsPrefix, "new-key")
		testValue := "new test value"
		saveKVHelper(t, kv, ctx, testSection, newKey, strings.NewReader(testValue))

		// Verify it was saved
		reader, err := kv.Get(ctx, testSection, newKey)
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, testValue, string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save overwrite existing key", func(t *testing.T) {
		overwriteKey := namespacedKey(nsPrefix, "overwrite-key")

		// First save
		saveKVHelper(t, kv, ctx, testSection, overwriteKey, strings.NewReader("old value"))

		// Overwrite
		newValue := "new value"
		saveKVHelper(t, kv, ctx, testSection, overwriteKey, strings.NewReader(newValue))

		// Verify it was updated
		reader, err := kv.Get(ctx, testSection, overwriteKey)
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, newValue, string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save overwrite existing key (datastore)", func(t *testing.T) {
		section := "unified/data"
		overwriteKey := namespacedKey(nsPrefix, "overwrite-key")

		// First save
		saveKVHelper(t, kv, ctx, section, overwriteKey, strings.NewReader("old value"))

		// Overwrite
		newValue := "new value"
		saveKVHelper(t, kv, ctx, section, overwriteKey, strings.NewReader(newValue))

		// Verify it was updated
		reader, err := kv.Get(ctx, section, overwriteKey)
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
		binaryKey := namespacedKey(nsPrefix, "binary-key")

		binaryData := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}
		saveKVHelper(t, kv, ctx, testSection, binaryKey, bytes.NewReader(binaryData))

		// Verify binary data
		reader, err := kv.Get(ctx, testSection, binaryKey)
		require.NoError(t, err)

		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, binaryData, value)
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("save key with no data", func(t *testing.T) {
		emptyKey := namespacedKey(nsPrefix, "empty-key")

		// Save a key with empty data
		saveKVHelper(t, kv, ctx, testSection, emptyKey, strings.NewReader(""))

		// Verify it was saved with empty data
		reader, err := kv.Get(ctx, testSection, emptyKey)
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
	nsPrefix += "-delete"

	t.Run("delete existing key", func(t *testing.T) {
		// First create a key
		deleteKey := namespacedKey(nsPrefix, "delete-key")
		saveKVHelper(t, kv, ctx, testSection, deleteKey, strings.NewReader("delete me"))

		// Verify it exists
		_, err := kv.Get(ctx, testSection, deleteKey)
		require.NoError(t, err)

		// Delete it
		err = kv.Delete(ctx, testSection, deleteKey)
		require.NoError(t, err)

		// Verify it's gone
		_, err = kv.Get(ctx, testSection, deleteKey)
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("delete non-existent key", func(t *testing.T) {
		err := kv.Delete(ctx, testSection, namespacedKey(nsPrefix, "non-existent-delete-key"))
		assert.NoError(t, err)
	})

	t.Run("delete with empty section", func(t *testing.T) {
		err := kv.Delete(ctx, "", namespacedKey(nsPrefix, "some-key"))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})

	t.Run("delete with empty key", func(t *testing.T) {
		err := kv.Delete(ctx, testSection, "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "key is required")
	})
}

func runTestKVKeys(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-keys"

	// Setup test data
	testKeys := namespacedKeys(nsPrefix, []string{"a1", "a2", "b1", "b2", "c1"})
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, testSection, key, strings.NewReader("value"+key))
	}

	t.Run("list all keys", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{}) {
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
				continue
			}
			keys = append(keys, k)
		}
		require.Len(t, errors, 1)
		assert.Contains(t, errors[0].Error(), "section is required")
		assert.Empty(t, keys)
	})

	t.Run("invalid sort option, defaults to asc", func(t *testing.T) {
		var keys []string
		var errors []error
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			Sort: resource.SortOrder(100),
		}) {
			if err != nil {
				errors = append(errors, err)
				continue
			}
			keys = append(keys, k)
		}
		assert.Empty(t, errors)
		assert.Equal(t, testKeys, keys)
	})

	t.Run("list keys with end key < start key", func(t *testing.T) {
		var keys []string
		var errors []error
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: namespacedKey(nsPrefix, "c"),
			EndKey:   namespacedKey(nsPrefix, "a"),
		}) {
			if err != nil {
				errors = append(errors, err)
				continue
			}
			keys = append(keys, k)
		}
		// Nothing is yielded
		assert.Empty(t, errors)
		assert.Empty(t, keys)
	})

	t.Run("list keys returns 0 keys", func(t *testing.T) {
		// Use a key range with no keys.
		startKey, endKey := "aaaaa", "aaaaz"

		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: startKey,
			EndKey:   endKey,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Empty(t, keys)
		assert.Len(t, keys, 0)
	})

	t.Run("interrupting the iterator", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{}) {
			require.NoError(t, err)
			keys = append(keys, k)

			if len(keys) == 2 {
				break
			}
		}

		assert.Equal(t, namespacedKeys(nsPrefix, []string{"a1", "a2"}), keys)
	})
}

func runTestKVKeysWithLimits(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-keys-with-limits"

	// Setup test data
	testKeys := namespacedKeys(nsPrefix, []string{"a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"})
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, testSection, key, strings.NewReader("value"+key))
	}

	t.Run("keys with limit", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{Limit: 3}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"a1", "a2", "b1"}), keys)
	})

	t.Run("keys with range", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: namespacedKey(nsPrefix, "b"),
			EndKey:   namespacedKey(nsPrefix, "d"),
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"b1", "b2", "c1", "c2"}), keys)
	})

	t.Run("keys with prefix", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: namespacedKey(nsPrefix, "c"),
			EndKey:   namespacedKey(nsPrefix, resource.PrefixRangeEnd("c")),
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"c1", "c2"}), keys)
	})

	t.Run("keys with limit and range", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: namespacedKey(nsPrefix, "a"),
			EndKey:   namespacedKey(nsPrefix, "c"),
			Limit:    2,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"a1", "a2"}), keys)
	})
}

func runTestKVKeysWithSort(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-keys-with-sort"

	// Setup test data
	testKeys := namespacedKeys(nsPrefix, []string{"a1", "a2", "b1", "b2", "c1"})
	for _, key := range testKeys {
		saveKVHelper(t, kv, ctx, testSection, key, strings.NewReader("value"+key))
	}

	t.Run("keys in ascending order (default)", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{Sort: resource.SortOrderAsc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"a1", "a2", "b1", "b2", "c1"}), keys)
	})

	t.Run("keys in descending order", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{Sort: resource.SortOrderDesc}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"c1", "b2", "b1", "a2", "a1"}), keys)
	})

	t.Run("keys descending with prefix", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			StartKey: namespacedKey(nsPrefix, "a"),
			EndKey:   namespacedKey(nsPrefix, resource.PrefixRangeEnd("a")),
			Sort:     resource.SortOrderDesc,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"a2", "a1"}), keys)
	})

	t.Run("keys descending with limit", func(t *testing.T) {
		var keys []string //nolint:prealloc
		for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{
			Sort:  resource.SortOrderDesc,
			Limit: 3,
		}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		assert.Equal(t, namespacedKeys(nsPrefix, []string{"c1", "b2", "b1"}), keys)
	})
}

func runTestKVConcurrent(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(60*time.Second))
	nsPrefix += "-concurrent"

	// Test concurrent operations for both sections, as they have different behaviours
	// in the sqlkv implementation.
	for _, testSection := range []string{"unified/data", "unified/events"} {
		t.Run(testSection, func(t *testing.T) {
			t.Run("concurrent save and get operations", func(t *testing.T) {
				const numGoroutines = 10
				const numOperations = 20

				done := make(chan error, numGoroutines)

				for goroutineID := range numGoroutines {
					go func() {
						var err error
						defer func() { done <- err }()

						for j := range numOperations {
							key := namespacedKey(nsPrefix, fmt.Sprintf("concurrent-key-%d-%d", goroutineID, j))
							value := fmt.Sprintf("concurrent-value-%d-%d", goroutineID, j)

							// Save
							writer, err := kv.Save(ctx, testSection, key)
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
							reader, err := kv.Get(ctx, testSection, key)
							if err != nil {
								return
							}

							readValue, err := io.ReadAll(reader)
							require.NoError(t, err)
							err = reader.Close()
							require.NoError(t, err)
							assert.Equal(t, value, string(readValue))
						}
					}()
				}

				// Wait for all goroutines to complete
				for range numGoroutines {
					err := <-done
					require.NoError(t, err)
				}
			})

			t.Run("concurrent save, delete, and list operations", func(t *testing.T) {
				const numGoroutines = 5
				done := make(chan error, numGoroutines)

				for i := range numGoroutines {
					go func(goroutineID int) {
						var err error
						defer func() { done <- err }()

						key := namespacedKey(nsPrefix, fmt.Sprintf("concurrent-ops-key-%d", goroutineID))
						value := fmt.Sprintf("concurrent-ops-value-%d", goroutineID)

						// Save
						writer, err := kv.Save(ctx, testSection, key)
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
						for k, err := range kv.Keys(ctx, testSection, resource.ListOptions{}) {
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
						err = kv.Delete(ctx, testSection, key)
						if err != nil {
							return
						}

						// Verify it's deleted
						_, err = kv.Get(ctx, testSection, key)
						require.ErrorIs(t, resource.ErrNotFound, err)
						err = nil // Expected error, so clear it
					}(i)
				}

				// Wait for all goroutines to complete
				for range numGoroutines {
					err := <-done
					require.NoError(t, err)
				}
			})
		})
	}
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

func runTestKVBatchGet(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-batchget"

	t.Run("batch get existing keys", func(t *testing.T) {
		// Setup test data
		testData := map[string]string{
			namespacedKey(nsPrefix, "key1"): "value1",
			namespacedKey(nsPrefix, "key2"): "value2",
			namespacedKey(nsPrefix, "key3"): "value3",
		}

		// Save test data
		for key, value := range testData {
			saveKVHelper(t, kv, ctx, testSection, key, strings.NewReader(value))
		}

		// Batch get all keys
		keys := namespacedKeys(nsPrefix, []string{"key1", "key2", "key3"})
		type result struct {
			key   string
			value string
		}
		var results []result //nolint:prealloc
		for kv, err := range kv.BatchGet(ctx, testSection, keys) {
			require.NoError(t, err)
			value, err := io.ReadAll(kv.Value)
			require.NoError(t, err)
			err = kv.Value.Close()
			require.NoError(t, err)
			results = append(results, result{key: kv.Key, value: string(value)})
		}

		// Verify results
		require.Len(t, results, 3)

		// Check that all keys are present and in order
		expectedKeys := namespacedKeys(nsPrefix, []string{"key1", "key2", "key3"})
		actualKeys := make([]string, len(results))
		for i, r := range results {
			actualKeys[i] = r.key
		}
		assert.Equal(t, expectedKeys, actualKeys)

		// Verify values
		for _, r := range results {
			assert.Equal(t, testData[r.key], r.value, "key = %s", r.key)
		}
	})

	t.Run("batch get with empty section", func(t *testing.T) {
		var kvs []resource.KeyValue
		var errs []error
		keys := namespacedKeys(nsPrefix, []string{"key1", "key2", "key3"})
		for kv, err := range kv.BatchGet(ctx, "", keys) {
			if err != nil {
				errs = append(errs, err)
				continue
			}

			kvs = append(kvs, kv)
		}

		require.Len(t, errs, 1)
		assert.Contains(t, errs[0].Error(), "section is required")
		assert.Empty(t, kvs)
	})

	t.Run("batch get with non-existent keys", func(t *testing.T) {
		// Setup some test data
		saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, "existing-key"), strings.NewReader("existing-value"))

		// Batch get with mix of existing and non-existent keys
		keys := namespacedKeys(nsPrefix, []string{"existing-key", "non-existent-1", "non-existent-2"})
		type result struct {
			key   string
			value string
		}
		var results []result //nolint:prealloc
		for kv, err := range kv.BatchGet(ctx, testSection, keys) {
			require.NoError(t, err)
			value, err := io.ReadAll(kv.Value)
			require.NoError(t, err)
			err = kv.Value.Close()
			require.NoError(t, err)
			results = append(results, result{key: kv.Key, value: string(value)})
		}

		// Should only return the existing key
		require.Len(t, results, 1)
		assert.Equal(t, namespacedKey(nsPrefix, "existing-key"), results[0].key)
		assert.Equal(t, "existing-value", results[0].value)
	})

	t.Run("batch get with all non-existent keys", func(t *testing.T) {
		keys := namespacedKeys(nsPrefix, []string{"non-existent-1", "non-existent-2", "non-existent-3"})
		var results []resource.KeyValue //nolint:prealloc
		for kv, err := range kv.BatchGet(ctx, testSection, keys) {
			require.NoError(t, err)
			results = append(results, kv)
		}

		// Should return no results
		assert.Empty(t, results)
	})

	t.Run("batch get with empty keys list", func(t *testing.T) {
		keys := []string{}
		var results []resource.KeyValue //nolint:prealloc
		for kv, err := range kv.BatchGet(ctx, testSection, keys) {
			require.NoError(t, err)
			results = append(results, kv)
		}

		// Should return no results
		assert.Empty(t, results)
	})

	t.Run("batch get with empty section", func(t *testing.T) {
		keys := namespacedKeys(nsPrefix, []string{"some-key"})
		var errors []error
		for kv, err := range kv.BatchGet(ctx, "", keys) {
			if err != nil {
				errors = append(errors, err)
				continue
			}
			_ = kv // unused
		}
		require.Len(t, errors, 1)
		assert.Contains(t, errors[0].Error(), "section is required")
	})

	t.Run("batch get preserves order", func(t *testing.T) {
		// Setup test data
		testData := map[string]string{
			"z-key": "z-value",
			"a-key": "a-value",
			"m-key": "m-value",
		}

		// Save test data
		for key, value := range testData {
			saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, key), strings.NewReader(value))
		}

		// Batch get in specific order
		keys := namespacedKeys(nsPrefix, []string{"z-key", "invalid-key1", "a-key", "invalid-key2", "m-key", "invalid-key3"})
		var results []string //nolint:prealloc
		for kv, err := range kv.BatchGet(ctx, testSection, keys) {
			require.NoError(t, err)
			err = kv.Value.Close()
			require.NoError(t, err)
			results = append(results, kv.Key)
		}

		// Verify order is preserved
		require.Len(t, results, 3)
		expectedOrder := namespacedKeys(nsPrefix, []string{"z-key", "a-key", "m-key"})
		assert.Equal(t, expectedOrder, results)
	})
}

func runTestKVBatchDelete(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	nsPrefix += "-batchdelete"

	t.Run("batch delete existing keys", func(t *testing.T) {
		// Setup test data
		testData := map[string]string{
			namespacedKey(nsPrefix, "key1"): "value1",
			namespacedKey(nsPrefix, "key2"): "value2",
			namespacedKey(nsPrefix, "key3"): "value3",
		}

		// Save test data
		for key, value := range testData {
			saveKVHelper(t, kv, ctx, testSection, key, strings.NewReader(value))
		}

		// Verify keys exist before deletion
		for key := range testData {
			_, err := kv.Get(ctx, testSection, key)
			require.NoError(t, err)
		}

		// Batch delete all keys
		keys := slices.Collect(maps.Keys(testData))
		err := kv.BatchDelete(ctx, testSection, keys)
		require.NoError(t, err)

		// Verify all keys are deleted
		for _, key := range keys {
			_, err := kv.Get(ctx, testSection, key)
			assert.Error(t, err)
			assert.Equal(t, resource.ErrNotFound, err)
		}
	})

	t.Run("batch delete with non-existent keys", func(t *testing.T) {
		// Setup some test data
		key1, key2 := namespacedKey(nsPrefix, "existing-key-1"), namespacedKey(nsPrefix, "existing-key-2")
		saveKVHelper(t, kv, ctx, testSection, key1, strings.NewReader("value1"))
		saveKVHelper(t, kv, ctx, testSection, key2, strings.NewReader("value2"))

		// Batch delete with mix of existing and non-existent keys
		keys := []string{key1, namespacedKey(nsPrefix, "non-existent-1"), key2, namespacedKey(nsPrefix, "non-existent-2")}
		err := kv.BatchDelete(ctx, testSection, keys)
		require.NoError(t, err)

		// Verify existing keys are deleted
		_, err = kv.Get(ctx, testSection, key1)
		require.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)

		_, err = kv.Get(ctx, testSection, key2)
		require.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)
	})

	t.Run("batch delete with all non-existent keys", func(t *testing.T) {
		// Batch delete keys that don't exist
		keys := namespacedKeys(nsPrefix, []string{"non-existent-1", "non-existent-2", "non-existent-3"})
		err := kv.BatchDelete(ctx, testSection, keys)
		require.NoError(t, err)
	})

	t.Run("batch delete with empty keys list", func(t *testing.T) {
		keys := []string{}
		err := kv.BatchDelete(ctx, testSection, keys)
		require.NoError(t, err)
	})

	t.Run("batch delete with empty section", func(t *testing.T) {
		keys := namespacedKeys(nsPrefix, []string{"some-key"})
		err := kv.BatchDelete(ctx, "", keys)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})

	t.Run("batch delete preserves other keys", func(t *testing.T) {
		// Setup test data
		saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, "keep-key-1"), strings.NewReader("keep-value-1"))
		saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, "delete-key-1"), strings.NewReader("delete-value-1"))
		saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, "keep-key-2"), strings.NewReader("keep-value-2"))
		saveKVHelper(t, kv, ctx, testSection, namespacedKey(nsPrefix, "delete-key-2"), strings.NewReader("delete-value-2"))

		// Batch delete specific keys
		keys := namespacedKeys(nsPrefix, []string{"delete-key-1", "delete-key-2"})
		err := kv.BatchDelete(ctx, testSection, keys)
		require.NoError(t, err)

		// Verify deleted keys are gone
		_, err = kv.Get(ctx, testSection, namespacedKey(nsPrefix, "delete-key-1"))
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)

		_, err = kv.Get(ctx, testSection, namespacedKey(nsPrefix, "delete-key-2"))
		assert.Error(t, err)
		assert.Equal(t, resource.ErrNotFound, err)

		// Verify kept keys still exist
		reader, err := kv.Get(ctx, testSection, namespacedKey(nsPrefix, "keep-key-1"))
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "keep-value-1", string(value))
		err = reader.Close()
		require.NoError(t, err)

		reader, err = kv.Get(ctx, testSection, namespacedKey(nsPrefix, "keep-key-2"))
		require.NoError(t, err)
		value, err = io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "keep-value-2", string(value))
		err = reader.Close()
		require.NoError(t, err)
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

func runTestKVBatch(t *testing.T, kv resource.KV, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	section := nsPrefix + "-batch"

	t.Run("batch with empty section", func(t *testing.T) {
		err := kv.Batch(ctx, "", nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "section is required")
	})

	t.Run("batch with empty ops succeeds", func(t *testing.T) {
		err := kv.Batch(ctx, section, nil)
		require.NoError(t, err)
	})

	t.Run("batch put creates new key", func(t *testing.T) {
		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpPut, Key: "put-key", Value: []byte("put-value")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify the key was created
		reader, err := kv.Get(ctx, section, "put-key")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "put-value", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch put updates existing key", func(t *testing.T) {
		// First create a key
		saveKVHelper(t, kv, ctx, section, "put-update-key", strings.NewReader("original-value"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpPut, Key: "put-update-key", Value: []byte("updated-value")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify the key was updated
		reader, err := kv.Get(ctx, section, "put-update-key")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "updated-value", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch create succeeds for new key", func(t *testing.T) {
		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpCreate, Key: "create-new-key", Value: []byte("new-value")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify the key was created
		reader, err := kv.Get(ctx, section, "create-new-key")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "new-value", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch create fails for existing key", func(t *testing.T) {
		// First create a key
		saveKVHelper(t, kv, ctx, section, "create-exists-key", strings.NewReader("existing-value"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpCreate, Key: "create-exists-key", Value: []byte("new-value")},
		}

		err := kv.Batch(ctx, section, ops)
		assert.ErrorIs(t, err, kvpkg.ErrKeyAlreadyExists)

		// Verify BatchError fields
		var batchErr *kvpkg.BatchError
		if assert.ErrorAs(t, err, &batchErr) {
			assert.Equal(t, 0, batchErr.Index, "failed operation index should be 0")
			assert.Equal(t, "create-exists-key", batchErr.Op.Key, "failed operation key should match")
			assert.Equal(t, kvpkg.BatchOpCreate, batchErr.Op.Mode, "failed operation mode should be Create")
		}

		// Verify the original value is unchanged
		reader, err := kv.Get(ctx, section, "create-exists-key")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "existing-value", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch update succeeds for existing key", func(t *testing.T) {
		// First create a key
		saveKVHelper(t, kv, ctx, section, "update-exists-key", strings.NewReader("original-value"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpUpdate, Key: "update-exists-key", Value: []byte("updated-value")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify the key was updated
		reader, err := kv.Get(ctx, section, "update-exists-key")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "updated-value", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch update fails for non-existent key", func(t *testing.T) {
		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpUpdate, Key: "update-nonexistent-key", Value: []byte("new-value")},
		}

		err := kv.Batch(ctx, section, ops)
		assert.ErrorIs(t, err, resource.ErrNotFound)

		// Verify BatchError fields
		var batchErr *kvpkg.BatchError
		if assert.ErrorAs(t, err, &batchErr) {
			assert.Equal(t, 0, batchErr.Index, "failed operation index should be 0")
			assert.Equal(t, "update-nonexistent-key", batchErr.Op.Key, "failed operation key should match")
			assert.Equal(t, kvpkg.BatchOpUpdate, batchErr.Op.Mode, "failed operation mode should be Update")
		}

		// Verify the key was not created
		_, err = kv.Get(ctx, section, "update-nonexistent-key")
		assert.ErrorIs(t, err, resource.ErrNotFound)
	})

	t.Run("batch delete removes existing key", func(t *testing.T) {
		// First create a key
		saveKVHelper(t, kv, ctx, section, "delete-exists-key", strings.NewReader("to-be-deleted"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpDelete, Key: "delete-exists-key"},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify the key was deleted
		_, err = kv.Get(ctx, section, "delete-exists-key")
		assert.ErrorIs(t, err, resource.ErrNotFound)
	})

	t.Run("batch delete is idempotent for non-existent key", func(t *testing.T) {
		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpDelete, Key: "delete-nonexistent-key"},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err) // Should succeed even though key doesn't exist
	})

	t.Run("batch multiple operations atomic success", func(t *testing.T) {
		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpPut, Key: "multi-key1", Value: []byte("value1")},
			{Mode: kvpkg.BatchOpPut, Key: "multi-key2", Value: []byte("value2")},
			{Mode: kvpkg.BatchOpPut, Key: "multi-key3", Value: []byte("value3")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify all keys were created
		for i := 1; i <= 3; i++ {
			key := fmt.Sprintf("multi-key%d", i)
			reader, err := kv.Get(ctx, section, key)
			require.NoError(t, err)
			value, err := io.ReadAll(reader)
			require.NoError(t, err)
			assert.Equal(t, fmt.Sprintf("value%d", i), string(value))
			err = reader.Close()
			require.NoError(t, err)
		}
	})

	t.Run("batch multiple operations atomic rollback on failure", func(t *testing.T) {
		// First create a key that will cause the batch to fail
		saveKVHelper(t, kv, ctx, section, "rollback-exists", strings.NewReader("existing"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpPut, Key: "rollback-new1", Value: []byte("value1")},
			{Mode: kvpkg.BatchOpCreate, Key: "rollback-exists", Value: []byte("should-fail")}, // This will fail
			{Mode: kvpkg.BatchOpPut, Key: "rollback-new2", Value: []byte("value2")},
		}

		err := kv.Batch(ctx, section, ops)
		assert.ErrorIs(t, err, kvpkg.ErrKeyAlreadyExists)

		// Verify BatchError identifies the correct operation
		var batchErr *kvpkg.BatchError
		if assert.ErrorAs(t, err, &batchErr) {
			assert.Equal(t, 1, batchErr.Index, "failed operation index should be 1 (second operation)")
			assert.Equal(t, "rollback-exists", batchErr.Op.Key, "failed operation key should match")
			assert.Equal(t, kvpkg.BatchOpCreate, batchErr.Op.Mode, "failed operation mode should be Create")
		}

		// Verify rollback: the first operation should NOT have persisted
		_, err = kv.Get(ctx, section, "rollback-new1")
		assert.ErrorIs(t, err, resource.ErrNotFound)

		// Verify the third operation was not executed
		_, err = kv.Get(ctx, section, "rollback-new2")
		assert.ErrorIs(t, err, resource.ErrNotFound)
	})

	t.Run("batch mixed operations", func(t *testing.T) {
		// Setup: create a key to update and one to delete
		saveKVHelper(t, kv, ctx, section, "mixed-update", strings.NewReader("original"))
		saveKVHelper(t, kv, ctx, section, "mixed-delete", strings.NewReader("to-delete"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpCreate, Key: "mixed-create", Value: []byte("created")},
			{Mode: kvpkg.BatchOpUpdate, Key: "mixed-update", Value: []byte("updated")},
			{Mode: kvpkg.BatchOpDelete, Key: "mixed-delete"},
			{Mode: kvpkg.BatchOpPut, Key: "mixed-put", Value: []byte("put")},
		}

		err := kv.Batch(ctx, section, ops)
		require.NoError(t, err)

		// Verify create
		reader, err := kv.Get(ctx, section, "mixed-create")
		require.NoError(t, err)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "created", string(value))
		err = reader.Close()
		require.NoError(t, err)

		// Verify update
		reader, err = kv.Get(ctx, section, "mixed-update")
		require.NoError(t, err)
		value, err = io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "updated", string(value))
		err = reader.Close()
		require.NoError(t, err)

		// Verify delete
		_, err = kv.Get(ctx, section, "mixed-delete")
		assert.ErrorIs(t, err, resource.ErrNotFound)

		// Verify put
		reader, err = kv.Get(ctx, section, "mixed-put")
		require.NoError(t, err)
		value, err = io.ReadAll(reader)
		require.NoError(t, err)
		assert.Equal(t, "put", string(value))
		err = reader.Close()
		require.NoError(t, err)
	})

	t.Run("batch too many operations", func(t *testing.T) {
		ops := make([]kvpkg.BatchOp, kvpkg.MaxBatchOps+1)
		for i := range ops {
			ops[i] = kvpkg.BatchOp{Mode: kvpkg.BatchOpPut, Key: fmt.Sprintf("key-%d", i), Value: []byte("value")}
		}

		err := kv.Batch(ctx, section, ops)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "too many operations")
	})

	t.Run("batch error context with later operation failure", func(t *testing.T) {
		// Create some keys first
		saveKVHelper(t, kv, ctx, section, "error-context-key2", strings.NewReader("existing"))

		ops := []resource.BatchOp{
			{Mode: kvpkg.BatchOpPut, Key: "error-context-key0", Value: []byte("value0")},
			{Mode: kvpkg.BatchOpPut, Key: "error-context-key1", Value: []byte("value1")},
			{Mode: kvpkg.BatchOpUpdate, Key: "error-context-nonexistent", Value: []byte("should-fail")}, // This will fail at index 2
			{Mode: kvpkg.BatchOpPut, Key: "error-context-key3", Value: []byte("value3")},
		}

		err := kv.Batch(ctx, section, ops)
		require.Error(t, err)

		// Verify BatchError provides correct context
		var batchErr *kvpkg.BatchError
		require.ErrorAs(t, err, &batchErr, "error should be a BatchError")
		assert.Equal(t, 2, batchErr.Index, "failed operation index should be 2")
		assert.Equal(t, "error-context-nonexistent", batchErr.Op.Key, "failed operation key should match")
		assert.Equal(t, kvpkg.BatchOpUpdate, batchErr.Op.Mode, "failed operation mode should be Update")
		assert.ErrorIs(t, batchErr.Err, resource.ErrNotFound, "underlying error should be ErrNotFound")

		// Verify error message contains useful information
		errMsg := err.Error()
		assert.Contains(t, errMsg, "batch operation 2", "error message should contain operation index")
		assert.Contains(t, errMsg, "error-context-nonexistent", "error message should contain key")

		// Verify atomic rollback - no keys should have been created
		_, err = kv.Get(ctx, section, "error-context-key0")
		assert.ErrorIs(t, err, resource.ErrNotFound, "first operation should have been rolled back")

		_, err = kv.Get(ctx, section, "error-context-key1")
		assert.ErrorIs(t, err, resource.ErrNotFound, "second operation should have been rolled back")

		_, err = kv.Get(ctx, section, "error-context-key3")
		assert.ErrorIs(t, err, resource.ErrNotFound, "fourth operation should not have been executed")
	})
}
