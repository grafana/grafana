package resource

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func setupTestDataStore(t *testing.T) *dataStore {
	kv := setupTestKV(t)
	return newDataStore(kv)
}

func TestNewDataStore(t *testing.T) {
	ds := setupTestDataStore(t)
	require.NotNil(t, ds)
}

func TestDataStore_GetPrefix(t *testing.T) {
	ds := setupTestDataStore(t)

	tests := []struct {
		name        string
		key         ListRequestKey
		expected    string
		expectError bool
	}{
		{
			name: "all fields provided",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expected: "test-namespace/test-group/test-resource/test-name/",
		},
		{
			name: "name is empty",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "",
			},
			expected: "test-namespace/test-group/test-resource/",
		},
		{
			name: "resource is empty",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "",
				Name:      "test-name", // This should be ignored when resource is empty
			},
			expectError: true, // Now expects error due to validation
		},
		{
			name: "group is empty",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "",
				Resource:  "test-resource", // This should be ignored when group is empty
				Name:      "test-name",     // This should be ignored when group is empty
			},
			expectError: true, // Now expects error due to validation
		},
		{
			name: "namespace is empty",
			key: ListRequestKey{
				Namespace: "",
				Group:     "test-group",    // This should be ignored when namespace is empty
				Resource:  "test-resource", // This should be ignored when namespace is empty
				Name:      "test-name",     // This should be ignored when namespace is empty
			},
			expectError: true, // Now expects error due to validation
		},
		{
			name: "only namespace provided",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "",
				Resource:  "",
				Name:      "",
			},
			expected: "test-namespace/",
		},
		{
			name: "namespace and group provided",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "",
				Name:      "",
			},
			expected: "test-namespace/test-group/",
		},
		{
			name: "all fields empty",
			key: ListRequestKey{
				Namespace: "",
				Group:     "",
				Resource:  "",
				Name:      "",
			},
			expected: "",
		},
		{
			name: "fields with special characters",
			key: ListRequestKey{
				Namespace: "test-namespace-with-dashes",
				Group:     "test.group.with.dots",
				Resource:  "test_resource_with_underscores",
				Name:      "test-name-with-multiple.special_chars",
			},
			expected: "test-namespace-with-dashes/test.group.with.dots/test_resource_with_underscores/test-name-with-multiple.special_chars/",
		},
		{
			name: "fields with leading/trailing spaces",
			key: ListRequestKey{
				Namespace: " test-namespace ",
				Group:     " test-group ",
				Resource:  " test-resource ",
				Name:      " test-name ",
			},
			expected: " test-namespace / test-group / test-resource / test-name /",
		},
		{
			name: "fields with forward slashes",
			key: ListRequestKey{
				Namespace: "test/namespace",
				Group:     "test/group",
				Resource:  "test/resource",
				Name:      "test/name",
			},
			expected: "test/namespace/test/group/test/resource/test/name/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := ds.getPrefix(tt.key)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, actual)
			}
		})
	}
}

func TestDataStore_GetKey(t *testing.T) {
	ds := setupTestDataStore(t)
	rv := int64(1934555792099250176)
	tests := []struct {
		name     string
		key      DataKey
		expected string
	}{
		{
			name: "created key",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expected: "test-namespace/test-group/test-resource/test-name/1934555792099250176~created",
		}, {
			name: "updated key",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionUpdated,
			},
			expected: "test-namespace/test-group/test-resource/test-name/1934555792099250176~updated",
		},
		{
			name: "deleted key",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionDeleted,
			},
			expected: "test-namespace/test-group/test-resource/test-name/1934555792099250176~deleted",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := ds.getKey(tt.key)
			require.Equal(t, tt.expected, actual)
		})
	}
}

func TestDataStore_ParseKey(t *testing.T) {
	ds := setupTestDataStore(t)

	rv := node.Generate()

	tests := []struct {
		name        string
		key         string
		expected    DataKey
		expectError bool
	}{
		{
			name: "valid normal key",
			key:  "test-namespace/test-group/test-resource/test-name/" + rv.String() + "~created",
			expected: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv.Int64(),
				Action:          DataActionCreated,
			},
		},
		{
			name: "valid deleted key",
			key:  "test-namespace/test-group/test-resource/test-name/" + rv.String() + "~deleted",
			expected: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv.Int64(),
				Action:          DataActionDeleted,
			},
		},
		{
			name:        "invalid key - too short",
			key:         "test",
			expectError: true,
		},
		{
			name:        "invalid key - invalid uuid",
			key:         "test-namespace/test-group/test-resource/test-name/invalid-uuid",
			expectError: true,
		},
		{
			name:        "invalid key - too many dashes in uuid part",
			key:         "test-namespace/test-group/test-resource/test-name/uuid-part-extra-dash",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := ds.parseKey(tt.key)

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, actual)
			}
		})
	}
}

func TestDataStore_Save_And_Get(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	rv := node.Generate()

	testKey := DataKey{
		Namespace:       "test-namespace",
		Group:           "test-group",
		Resource:        "test-resource",
		Name:            "test-name",
		ResourceVersion: rv.Int64(),
		Action:          DataActionCreated,
	}
	testValue := io.NopCloser(bytes.NewReader([]byte("test-value")))

	t.Run("save and get normal key", func(t *testing.T) {
		err := ds.Save(ctx, testKey, testValue)
		require.NoError(t, err)

		result, err := ds.Get(ctx, testKey)
		require.NoError(t, err)

		// Read the content and compare
		resultBytes, err := io.ReadAll(result)
		require.NoError(t, err)
		require.Equal(t, []byte("test-value"), resultBytes)
	})

	t.Run("save and get deleted key", func(t *testing.T) {
		deletedKey := testKey
		deletedKey.Action = DataActionDeleted
		deletedValue := io.NopCloser(bytes.NewReader([]byte("deleted-value")))

		err := ds.Save(ctx, deletedKey, deletedValue)
		require.NoError(t, err)

		result, err := ds.Get(ctx, deletedKey)
		require.NoError(t, err)

		// Read the content and compare
		resultBytes, err := io.ReadAll(result)
		require.NoError(t, err)
		require.Equal(t, []byte("deleted-value"), resultBytes)
	})

	t.Run("get non-existent key", func(t *testing.T) {
		rv := node.Generate()

		nonExistentKey := DataKey{
			Namespace:       "non-existent",
			Group:           "test-group",
			Resource:        "test-resource",
			Name:            "test-name",
			ResourceVersion: rv.Int64(),
			Action:          DataActionCreated,
		}

		_, err := ds.Get(ctx, nonExistentKey)
		require.Error(t, err)
		require.Equal(t, ErrNotFound, err)
	})
}

func TestDataStore_Delete(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	rv := node.Generate()

	testKey := DataKey{
		Namespace:       "test-namespace",
		Group:           "test-group",
		Resource:        "test-resource",
		Name:            "test-name",
		ResourceVersion: rv.Int64(),
		Action:          DataActionCreated,
	}
	testValue := io.NopCloser(bytes.NewReader([]byte("test-value")))

	t.Run("delete existing key", func(t *testing.T) {
		// First save the key
		err := ds.Save(ctx, testKey, testValue)
		require.NoError(t, err)

		// Verify it exists
		_, err = ds.Get(ctx, testKey)
		require.NoError(t, err)

		// Delete it
		err = ds.Delete(ctx, testKey)
		require.NoError(t, err)

		// Verify it's gone
		_, err = ds.Get(ctx, testKey)
		require.Error(t, err)
		require.Equal(t, ErrNotFound, err)
	})

	t.Run("delete non-existent key", func(t *testing.T) {
		nonExistentKey := DataKey{
			Namespace:       "non-existent",
			Group:           "test-group",
			Resource:        "test-resource",
			Name:            "test-name",
			ResourceVersion: rv.Int64(),
			Action:          DataActionCreated,
		}

		err := ds.Delete(ctx, nonExistentKey)
		require.NoError(t, err) // BadgerDB doesn't return error for non-existent keys
	})
}

func TestDataStore_List(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	resourceKey := ListRequestKey{
		Namespace: "test-namespace",
		Group:     "test-group",
		Resource:  "test-resource",
		Name:      "test-name",
	}

	// Create test data
	rv1 := node.Generate()
	rv2 := node.Generate()
	testValue1 := io.NopCloser(bytes.NewReader([]byte("test-value-1")))
	testValue2 := io.NopCloser(bytes.NewReader([]byte("test-value-2")))

	dataKey1 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv1.Int64(),
		Action:          DataActionCreated,
	}

	dataKey2 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv2.Int64(),
		Action:          DataActionCreated,
	}

	t.Run("list multiple keys", func(t *testing.T) {
		// Save test data
		err := ds.Save(ctx, dataKey1, testValue1)
		require.NoError(t, err)

		err = ds.Save(ctx, dataKey2, testValue2)
		require.NoError(t, err)

		// List the data
		var results []DataKey
		for key, err := range ds.Keys(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, key)
		}

		// Verify results
		require.Len(t, results, 2)

		// Check first result
		result1 := results[0]
		require.Equal(t, rv1.Int64(), result1.ResourceVersion)
		require.Equal(t, resourceKey.Namespace, result1.Namespace)
		require.Equal(t, resourceKey.Group, result1.Group)
		require.Equal(t, resourceKey.Resource, result1.Resource)
		require.Equal(t, DataActionCreated, result1.Action)

		// Check second result
		result2 := results[1]
		require.Equal(t, rv2.Int64(), result2.ResourceVersion)
		require.Equal(t, resourceKey.Namespace, result2.Namespace)
		require.Equal(t, resourceKey.Group, result2.Group)
		require.Equal(t, resourceKey.Resource, result2.Resource)
		require.Equal(t, DataActionCreated, result2.Action)
	})

	t.Run("list empty", func(t *testing.T) {
		emptyResourceKey := ListRequestKey{
			Namespace: "empty-namespace",
			Group:     "empty-group",
			Resource:  "empty-resource",
			Name:      "empty-name",
		}

		var results []DataKey
		for key, err := range ds.Keys(ctx, emptyResourceKey) {
			require.NoError(t, err)
			results = append(results, key)
		}

		require.Len(t, results, 0)
	})

	t.Run("list with deleted keys", func(t *testing.T) {
		deletedResourceKey := ListRequestKey{
			Namespace: "deleted-namespace",
			Group:     "deleted-group",
			Resource:  "deleted-resource",
			Name:      "deleted-name",
		}

		rv3 := node.Generate()
		testValue3 := io.NopCloser(bytes.NewReader([]byte("deleted-value")))

		deletedKey := DataKey{
			Namespace:       deletedResourceKey.Namespace,
			Group:           deletedResourceKey.Group,
			Resource:        deletedResourceKey.Resource,
			Name:            deletedResourceKey.Name,
			ResourceVersion: rv3.Int64(),
			Action:          DataActionDeleted,
		}

		// Save deleted key
		err := ds.Save(ctx, deletedKey, testValue3)
		require.NoError(t, err)

		// List should include deleted keys
		var results []DataKey
		for key, err := range ds.Keys(ctx, deletedResourceKey) {
			require.NoError(t, err)
			results = append(results, key)
		}

		require.Len(t, results, 1)
		require.Equal(t, rv3.Int64(), results[0].ResourceVersion)
		require.Equal(t, DataActionDeleted, results[0].Action)
	})
}

func TestDataStore_Integration(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	t.Run("full lifecycle test", func(t *testing.T) {
		resourceKey := ListRequestKey{
			Namespace: "integration-ns",
			Group:     "integration-group",
			Resource:  "integration-resource",
			Name:      "integration-name",
		}

		rv1 := node.Generate()
		rv2 := node.Generate()
		rv3 := node.Generate()

		// Create multiple versions
		versions := []struct {
			rv    int64
			value io.ReadCloser
		}{
			{rv1.Int64(), io.NopCloser(bytes.NewReader([]byte("version-1")))},
			{rv2.Int64(), io.NopCloser(bytes.NewReader([]byte("version-2")))},
			{rv3.Int64(), io.NopCloser(bytes.NewReader([]byte("version-3")))},
		}

		// Save all versions
		for _, version := range versions {
			dataKey := DataKey{
				Namespace:       resourceKey.Namespace,
				Group:           resourceKey.Group,
				Resource:        resourceKey.Resource,
				Name:            resourceKey.Name,
				ResourceVersion: version.rv,
				Action:          DataActionUpdated,
			}

			err := ds.Save(ctx, dataKey, version.value)
			require.NoError(t, err)
		}

		// List all versions
		var results []DataKey
		for key, err := range ds.Keys(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, key)
		}

		require.Len(t, results, 3)

		// Delete one version
		deleteKey := DataKey{
			Namespace:       resourceKey.Namespace,
			Group:           resourceKey.Group,
			Resource:        resourceKey.Resource,
			Name:            resourceKey.Name,
			ResourceVersion: versions[1].rv,
			Action:          DataActionUpdated,
		}

		err := ds.Delete(ctx, deleteKey)
		require.NoError(t, err)

		// Verify it's gone
		_, err = ds.Get(ctx, deleteKey)
		require.Equal(t, ErrNotFound, err)

		// List should now have 2 items
		results = nil
		for key, err := range ds.Keys(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, key)
		}

		require.Len(t, results, 2)

		// Verify remaining items
		remainingUUIDs := make(map[int64]bool)
		for _, result := range results {
			remainingUUIDs[result.ResourceVersion] = true
		}

		require.True(t, remainingUUIDs[versions[0].rv])
		require.False(t, remainingUUIDs[versions[1].rv]) // deleted
		require.True(t, remainingUUIDs[versions[2].rv])
	})
}

func TestDataStore_Keys(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	resourceKey := ListRequestKey{
		Namespace: "test-namespace",
		Group:     "test-group",
		Resource:  "test-resource",
		Name:      "test-name",
	}

	// Create test data
	rv1 := node.Generate()
	rv2 := node.Generate()
	rv3 := node.Generate()
	testValue1 := io.NopCloser(bytes.NewReader([]byte("test-value-1")))
	testValue2 := io.NopCloser(bytes.NewReader([]byte("test-value-2")))
	testValue3 := io.NopCloser(bytes.NewReader([]byte("test-value-3")))

	dataKey1 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv1.Int64(),
		Action:          DataActionCreated,
	}

	dataKey2 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv2.Int64(),
		Action:          DataActionUpdated,
	}

	dataKey3 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv3.Int64(),
		Action:          DataActionDeleted,
	}

	t.Run("keys with multiple entries", func(t *testing.T) {
		// Save test data
		err := ds.Save(ctx, dataKey1, testValue1)
		require.NoError(t, err)

		err = ds.Save(ctx, dataKey2, testValue2)
		require.NoError(t, err)

		err = ds.Save(ctx, dataKey3, testValue3)
		require.NoError(t, err)

		// Get keys
		var keys []DataKey
		for key, err := range ds.Keys(ctx, resourceKey) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		// Verify results
		require.Len(t, keys, 3)

		// Verify all keys are present
		expectedKeys := []DataKey{
			dataKey1,
			dataKey2,
			dataKey3,
		}

		for _, expectedKey := range expectedKeys {
			require.Contains(t, keys, expectedKey)
		}
	})

	t.Run("keys with empty result", func(t *testing.T) {
		emptyResourceKey := ListRequestKey{
			Namespace: "empty-namespace",
			Group:     "empty-group",
			Resource:  "empty-resource",
			Name:      "empty-name",
		}

		var keys []DataKey
		for key, err := range ds.Keys(ctx, emptyResourceKey) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		require.Len(t, keys, 0)
	})

	t.Run("keys with partial prefix matching", func(t *testing.T) {
		// Create keys with different names but same namespace/group/resource
		partialKey := ListRequestKey{
			Namespace: resourceKey.Namespace,
			Group:     resourceKey.Group,
			Resource:  resourceKey.Resource,
			// Name is empty, so it should match all names
		}

		rv4 := node.Generate()
		dataKey4 := DataKey{
			Namespace:       resourceKey.Namespace,
			Group:           resourceKey.Group,
			Resource:        resourceKey.Resource,
			Name:            "different-name",
			ResourceVersion: rv4.Int64(),
			Action:          DataActionCreated,
		}

		err := ds.Save(ctx, dataKey4, io.NopCloser(bytes.NewReader([]byte("different-value"))))
		require.NoError(t, err)

		var keys []DataKey
		for key, err := range ds.Keys(ctx, partialKey) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		// Should include all keys with matching namespace/group/resource
		require.Len(t, keys, 4) // 3 from previous test + 1 new one

		// Verify the new key is included
		require.Contains(t, keys, dataKey4)
	})

	t.Run("keys with namespace only prefix", func(t *testing.T) {
		// Create keys with different groups but same namespace
		namespaceOnlyKey := ListRequestKey{
			Namespace: resourceKey.Namespace,
			// Group, Resource, Name are empty
		}

		rv5 := node.Generate()
		dataKey5 := DataKey{
			Namespace:       resourceKey.Namespace,
			Group:           "different-group",
			Resource:        "different-resource",
			Name:            "different-name",
			ResourceVersion: rv5.Int64(),
			Action:          DataActionCreated,
		}

		err := ds.Save(ctx, dataKey5, io.NopCloser(bytes.NewReader([]byte("namespace-only-value"))))
		require.NoError(t, err)

		var keys []DataKey
		for key, err := range ds.Keys(ctx, namespaceOnlyKey) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		// Should include all keys with matching namespace
		require.Len(t, keys, 5) // 4 from previous tests + 1 new one

		// Verify the new key is included
		require.Contains(t, keys, dataKey5)
	})

	t.Run("keys with empty namespace", func(t *testing.T) {
		// Group, Resource, Name are provided but will be ignored due to validation
		emptyNamespaceKey := ListRequestKey{
			Namespace: "",
			Group:     "test-group",
			Resource:  "test-resource",
			Name:      "test-name",
		}

		var keys []DataKey
		var hasError bool
		for key, err := range ds.Keys(ctx, emptyNamespaceKey) {
			if err != nil {
				hasError = true
				require.Error(t, err)
				require.Contains(t, err.Error(), "namespace is required")
				break
			}
			keys = append(keys, key)
		}

		// Should get an error due to validation
		require.True(t, hasError, "Expected an error due to empty namespace with other fields provided")
	})
}
