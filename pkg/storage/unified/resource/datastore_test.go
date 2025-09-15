package resource

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"testing"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
)

var node, _ = snowflake.NewNode(1)

func setupTestDataStore(t *testing.T) *dataStore {
	kv := setupTestKV(t)
	return newDataStore(kv)
}

func TestNewDataStore(t *testing.T) {
	ds := setupTestDataStore(t)
	require.NotNil(t, ds)
}

func TestDataKey_String(t *testing.T) {
	rv := int64(1934555792099250176)
	tests := []struct {
		name     string
		key      DataKey
		expected string
	}{
		{
			name: "created key",
			key: DataKey{
				Group:           "test-group",
				Resource:        "test-resource",
				Namespace:       "test-namespace",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: "test-group/test-resource/test-namespace/test-name/1934555792099250176~created~test-folder",
		}, {
			name: "updated key",
			key: DataKey{
				Group:           "test-group",
				Resource:        "test-resource",
				Namespace:       "test-namespace",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionUpdated,
				Folder:          "test-folder",
			},
			expected: "test-group/test-resource/test-namespace/test-name/1934555792099250176~updated~test-folder",
		},
		{
			name: "deleted key",
			key: DataKey{
				Group:           "test-group",
				Resource:        "test-resource",
				Namespace:       "test-namespace",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionDeleted,
				Folder:          "test-folder",
			},
			expected: "test-group/test-resource/test-namespace/test-name/1934555792099250176~deleted~test-folder",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := tt.key.String()
			require.Equal(t, tt.expected, actual)
		})
	}
}

func TestDataKey_Validate(t *testing.T) {
	rv := int64(1234567890)

	tests := []struct {
		name        string
		key         DataKey
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid key with created action",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: false,
		},
		{
			name: "valid key with updated action",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionUpdated,
			},
			expectError: false,
		},
		{
			name: "valid key with deleted action",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionDeleted,
			},
			expectError: false,
		},
		{
			name: "valid key with dots and dashes",
			key: DataKey{
				Namespace:       "test.namespace-with-dashes",
				Group:           "test.group-123",
				Resource:        "test-resource.v1",
				Name:            "test-name.with.dots",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: false,
		},
		{
			name: "valid key with single character names",
			key: DataKey{
				Namespace:       "a",
				Group:           "b",
				Resource:        "c",
				Name:            "d",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: false,
		},
		{
			name: "valid key with numbers",
			key: DataKey{
				Namespace:       "namespace123",
				Group:           "group456",
				Resource:        "resource789",
				Name:            "name000",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: false,
		},
		// Invalid cases - empty fields
		{
			name: "invalid - empty namespace",
			key: DataKey{
				Namespace:       "",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "namespace is required",
		},
		{
			name: "invalid - empty group",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "group is required",
		},
		{
			name: "invalid - empty resource",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "resource is required",
		},
		{
			name: "invalid - empty name",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "invalid - empty action",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          "",
			},
			expectError: true,
			errorMsg:    "action is required",
		},
		{
			name: "invalid - all fields empty",
			key: DataKey{
				Namespace:       "",
				Group:           "",
				Resource:        "",
				Name:            "",
				ResourceVersion: rv,
				Action:          "",
			},
			expectError: true,
			errorMsg:    "group is required",
		},
		// Invalid cases - uppercase characters
		{
			name: "invalid - uppercase in namespace",
			key: DataKey{
				Namespace:       "Test-Namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "namespace 'Test-Namespace' is invalid",
		},
		{
			name: "invalid - uppercase in group",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "Test-Group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "group 'Test-Group' is invalid",
		},
		{
			name: "invalid - uppercase in resource",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "Test-Resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "resource 'Test-Resource' is invalid",
		},
		{
			name: "invalid - uppercase in name",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "Test-Name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "name 'Test-Name' is invalid",
		},
		// Invalid cases - invalid characters
		{
			name: "invalid - underscore in namespace",
			key: DataKey{
				Namespace:       "test_namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "namespace 'test_namespace' is invalid",
		},
		{
			name: "invalid - space in group",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "group 'test group' is invalid",
		},
		{
			name: "invalid - special character in resource",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test@resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "resource 'test@resource' is invalid",
		},
		{
			name: "invalid - slash in name",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test/name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "name 'test/name' is invalid",
		},
		// Invalid cases - start/end with invalid characters
		{
			name: "invalid - namespace starts with dash",
			key: DataKey{
				Namespace:       "-test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "namespace '-test-namespace' is invalid",
		},
		{
			name: "invalid - group ends with dot",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group.",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "group 'test-group.' is invalid",
		},
		{
			name: "invalid - resource starts with dot",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        ".test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "resource '.test-resource' is invalid",
		},
		{
			name: "invalid - name ends with dash",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name-",
				ResourceVersion: rv,
				Action:          DataActionCreated,
			},
			expectError: true,
			errorMsg:    "name 'test-name-' is invalid",
		},
		// Invalid cases - invalid action
		{
			name: "invalid - unknown action",
			key: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv,
				Action:          DataAction("unknown"),
			},
			expectError: true,
			errorMsg:    "action 'unknown' is invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			if tt.expectError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestParseKey(t *testing.T) {
	rv := node.Generate()

	tests := []struct {
		name        string
		key         string
		expected    DataKey
		expectError bool
	}{
		{
			name: "valid normal key",
			key:  "test-group/test-resource/test-namespace/test-name/" + rv.String() + "~created~team-folder",
			expected: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv.Int64(),
				Action:          DataActionCreated,
				Folder:          "team-folder",
			},
		},
		{
			name: "valid deleted key",
			key:  "test-group/test-resource/test-namespace/test-name/" + rv.String() + "~deleted~team-folder",
			expected: DataKey{
				Namespace:       "test-namespace",
				Group:           "test-group",
				Resource:        "test-resource",
				Name:            "test-name",
				ResourceVersion: rv.Int64(),
				Action:          DataActionDeleted,
				Folder:          "team-folder",
			},
		},
		{
			name:        "invalid key - too short",
			key:         "test",
			expectError: true,
		},
		{
			name:        "invalid key - too many slashes",
			key:         "test-group/test-resource/test-namespace/test-name/1934555792099250176~created~team-folder/extra-slash",
			expectError: true,
		},
		{
			name:        "invalid key - invalid rv",
			key:         "test-group/test-resource/test-namespace/test-name/invalid-rv~team-folder",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := ParseKey(tt.key)

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
		Group:           "test-group",
		Resource:        "test-resource",
		Namespace:       "test-namespace",
		Name:            "test-name",
		ResourceVersion: rv.Int64(),
		Action:          DataActionCreated,
	}
	testValue := bytes.NewReader([]byte("test-value"))

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
		deletedValue := bytes.NewReader([]byte("deleted-value"))

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
			Group:           "test-group",
			Resource:        "test-resource",
			Namespace:       "non-existent",
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
		Group:           "test-group",
		Resource:        "test-resource",
		Namespace:       "test-namespace",
		Name:            "test-name",
		ResourceVersion: rv.Int64(),
		Action:          DataActionCreated,
	}
	testValue := bytes.NewReader([]byte("test-value"))

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
		require.Error(t, err)
		require.Equal(t, ErrNotFound, err)
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
	testValue1 := bytes.NewReader([]byte("test-value-1"))
	testValue2 := bytes.NewReader([]byte("test-value-2"))

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
		results := make([]DataKey, 0, 2)
		for key, err := range ds.Keys(ctx, resourceKey, SortOrderAsc) {
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

		results := make([]DataKey, 0, 1)
		for key, err := range ds.Keys(ctx, emptyResourceKey, SortOrderAsc) {
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
		testValue3 := bytes.NewReader([]byte("deleted-value"))

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
		results := make([]DataKey, 0, 2)
		for key, err := range ds.Keys(ctx, deletedResourceKey, SortOrderAsc) {
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
			value io.Reader
		}{
			{rv1.Int64(), bytes.NewReader([]byte("version-1"))},
			{rv2.Int64(), bytes.NewReader([]byte("version-2"))},
			{rv3.Int64(), bytes.NewReader([]byte("version-3"))},
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
		results := make([]DataKey, 0, 3)
		for key, err := range ds.Keys(ctx, resourceKey, SortOrderAsc) {
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
		for key, err := range ds.Keys(ctx, resourceKey, SortOrderAsc) {
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
	testValue1 := bytes.NewReader([]byte("test-value-1"))
	testValue2 := bytes.NewReader([]byte("test-value-2"))
	testValue3 := bytes.NewReader([]byte("test-value-3"))

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
		keys := make([]DataKey, 0, 2)
		for key, err := range ds.Keys(ctx, resourceKey, SortOrderAsc) {
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

		keys := make([]DataKey, 0, 1)
		for key, err := range ds.Keys(ctx, emptyResourceKey, SortOrderAsc) {
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

		keys := make([]DataKey, 0, 4)
		for key, err := range ds.Keys(ctx, partialKey, SortOrderAsc) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		// Should include all keys with matching namespace/group/resource
		require.Len(t, keys, 4) // 3 from previous test + 1 new one

		// Verify the new key is included
		require.Contains(t, keys, dataKey4)
	})

	t.Run("keys with group and resource only prefix", func(t *testing.T) {
		groupAndResourceKey := ListRequestKey{
			Group:    "test-group",
			Resource: "test-resource",
		}

		keys := make([]DataKey, 0, 4)
		for key, err := range ds.Keys(ctx, groupAndResourceKey, SortOrderAsc) {
			require.NoError(t, err)
			keys = append(keys, key)
		}

		require.Len(t, keys, 4)
	})
}

func TestDataStore_ValidationEnforced(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	// Create an invalid key
	invalidKey := DataKey{
		Namespace:       "Invalid-Namespace", // uppercase is invalid
		Group:           "test-group",
		Resource:        "test-resource",
		Name:            "test-name",
		ResourceVersion: 123456789,
		Action:          DataActionCreated,
	}

	testValue := io.NopCloser(bytes.NewReader([]byte("test-value")))

	t.Run("Get with invalid key returns validation error", func(t *testing.T) {
		_, err := ds.Get(ctx, invalidKey)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace 'Invalid-Namespace' is invalid")
	})

	t.Run("Save with invalid key returns validation error", func(t *testing.T) {
		err := ds.Save(ctx, invalidKey, testValue)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace 'Invalid-Namespace' is invalid")
	})

	t.Run("Delete with invalid key returns validation error", func(t *testing.T) {
		err := ds.Delete(ctx, invalidKey)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace 'Invalid-Namespace' is invalid")
	})

	// Test another type of invalid key
	emptyFieldKey := DataKey{
		Namespace:       "",
		Group:           "test-group",
		Resource:        "test-resource",
		Name:            "test-name",
		ResourceVersion: 123456789,
		Action:          DataActionCreated,
	}

	t.Run("Get with empty namespace returns validation error", func(t *testing.T) {
		_, err := ds.Get(ctx, emptyFieldKey)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace is required")
	})

	t.Run("Save with empty namespace returns validation error", func(t *testing.T) {
		err := ds.Save(ctx, emptyFieldKey, testValue)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace is required")
	})

	t.Run("Delete with empty namespace returns validation error", func(t *testing.T) {
		err := ds.Delete(ctx, emptyFieldKey)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid data key")
		require.Contains(t, err.Error(), "namespace is required")
	})
}

func TestListRequestKey_Validate(t *testing.T) {
	tests := []struct {
		name        string
		key         ListRequestKey
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid - all fields provided",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: false,
		},
		{
			name: "valid - only group and resource",
			key: ListRequestKey{
				Group:    "test-group",
				Resource: "test-resource",
			},
			expectError: false,
		},
		{
			name: "valid - namespace and group and resource",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
			},
			expectError: false,
		},
		{
			name:        "invalid - all empty",
			key:         ListRequestKey{},
			expectError: true,
			errorMsg:    "group is required",
		},
		// Invalid hierarchical cases
		{
			name: "invalid - group without resource",
			key: ListRequestKey{
				Group: "test-group",
			},
			expectError: true,
			errorMsg:    "resource is required",
		},
		{
			name: "invalid - name without namespace",
			key: ListRequestKey{
				Name:     "test-name",
				Resource: "test-resource",
				Group:    "test-group",
			},
			expectError: true,
			errorMsg:    "name must be empty when namespace is empty",
		},
		{
			name: "invalid - name without group and resource",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "group is required",
		},
		// Invalid naming cases
		{
			name: "invalid - uppercase in namespace",
			key: ListRequestKey{
				Namespace: "Test-Namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "namespace 'Test-Namespace' is invalid",
		},
		{
			name: "invalid - uppercase in group and resource",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "Test-Group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "group 'Test-Group' is invalid",
		},
		{
			name: "invalid - uppercase in resource",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "Test-Resource",
			},
			expectError: true,
			errorMsg:    "resource 'Test-Resource' is invalid",
		},
		{
			name: "invalid - uppercase in name",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "Test-Name",
			},
			expectError: true,
			errorMsg:    "name 'Test-Name' is invalid",
		},
		{
			name: "invalid - underscore in namespace",
			key: ListRequestKey{
				Namespace: "test_namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "namespace 'test_namespace' is invalid",
		},
		{
			name: "invalid - starts with dash",
			key: ListRequestKey{
				Namespace: "-test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "namespace '-test-namespace' is invalid",
		},
		{
			name: "invalid - ends with dot",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group.",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expectError: true,
			errorMsg:    "group 'test-group.' is invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			if tt.expectError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestListRequestKey_Prefix(t *testing.T) {
	tests := []struct {
		name     string
		key      ListRequestKey
		expected string
	}{
		{
			name: "all fields provided",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			expected: "test-group/test-resource/test-namespace/test-name/",
		},
		{
			name: "name is empty",
			key: ListRequestKey{
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "",
			},
			expected: "test-group/test-resource/test-namespace/",
		},
		{
			name: "namespace is empty",
			key: ListRequestKey{
				Group:     "test-group",
				Namespace: "",
				Resource:  "test-resource",
				Name:      "",
			},
			expected: "test-group/test-resource/",
		},
		{
			name: "fields with special characters",
			key: ListRequestKey{
				Namespace: "test-namespace-with-dashes",
				Group:     "test.group.with.dots",
				Resource:  "test-resource",
				Name:      "test-name-with-multiple.special-chars",
			},
			expected: "test.group.with.dots/test-resource/test-namespace-with-dashes/test-name-with-multiple.special-chars/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := tt.key.Prefix()
			require.Equal(t, tt.expected, actual)
		})
	}
}

func TestDataStore_LastResourceVersion(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	t.Run("returns last resource version for existing data", func(t *testing.T) {
		resourceKey := ListRequestKey{
			Namespace: "test-namespace",
			Group:     "test-group",
			Resource:  "test-resource",
			Name:      "test-name",
		}

		// Create test data with multiple versions
		rv1 := node.Generate()
		rv2 := node.Generate()
		rv3 := node.Generate()

		versions := []int64{
			rv1.Int64(),
			rv2.Int64(),
			rv3.Int64(),
		}

		// Save all versions
		for _, version := range versions {
			dataKey := DataKey{
				Namespace:       resourceKey.Namespace,
				Group:           resourceKey.Group,
				Resource:        resourceKey.Resource,
				Name:            resourceKey.Name,
				ResourceVersion: version,
				Action:          DataActionCreated,
			}

			err := ds.Save(ctx, dataKey, bytes.NewReader([]byte(fmt.Sprintf("version-%d", version))))
			require.NoError(t, err)
		}

		// Get the last resource version
		lastKey, err := ds.LastResourceVersion(ctx, resourceKey)
		require.NoError(t, err)

		// Verify the result
		require.Equal(t, resourceKey.Namespace, lastKey.Namespace)
		require.Equal(t, resourceKey.Group, lastKey.Group)
		require.Equal(t, resourceKey.Resource, lastKey.Resource)
		require.Equal(t, resourceKey.Name, lastKey.Name)
		require.Equal(t, DataActionCreated, lastKey.Action)

		require.Equal(t, rv3.Int64(), lastKey.ResourceVersion)
	})

	t.Run("returns error for non-existent resource", func(t *testing.T) {
		nonExistentKey := ListRequestKey{
			Namespace: "non-existent-namespace",
			Group:     "non-existent-group",
			Resource:  "non-existent-resource",
			Name:      "non-existent-name",
		}

		_, err := ds.LastResourceVersion(ctx, nonExistentKey)
		require.Error(t, err)
		require.Equal(t, ErrNotFound, err)
	})

	t.Run("returns error for empty required fields", func(t *testing.T) {
		testCases := map[string]ListRequestKey{
			"empty namespace": {
				Namespace: "",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			"empty group": {
				Namespace: "test-namespace",
				Group:     "",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			"empty resource": {
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "",
				Name:      "test-name",
			},
			"empty name": {
				Namespace: "test-namespace",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "",
			},
		}

		for name, key := range testCases {
			t.Run(name, func(t *testing.T) {
				_, err := ds.LastResourceVersion(ctx, key)
				require.Error(t, err)
			})
		}
	})
}

func TestDataStore_GetLatestResourceKey(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	key := GetRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Create multiple versions with different timestamps
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	// Save multiple versions (rv3 should be latest)
	dataKey1 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey2 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv2,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}
	dataKey3 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv3,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey1, bytes.NewReader([]byte("version1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey2, bytes.NewReader([]byte("version2")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey3, bytes.NewReader([]byte("version3")))
	require.NoError(t, err)

	// GetLatestResourceKey should return rv3
	latestKey, err := ds.GetLatestResourceKey(ctx, key)
	require.NoError(t, err)

	require.Equal(t, dataKey3, latestKey)
	require.Equal(t, rv3, latestKey.ResourceVersion)
	require.Equal(t, DataActionUpdated, latestKey.Action)
}

func TestDataStore_GetLatestResourceKey_Deleted(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	key := GetRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "test-resource",
	}

	dataKey := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionDeleted,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey, bytes.NewReader([]byte("deleted")))
	require.NoError(t, err)

	_, err = ds.GetLatestResourceKey(ctx, key)
	require.Equal(t, ErrNotFound, err)
}

func TestDataStore_GetLatestResourceKey_NotFound(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	key := GetRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "non-existent",
	}

	_, err := ds.GetLatestResourceKey(ctx, key)
	require.Equal(t, ErrNotFound, err)
}

func TestDataStore_GetResourceKeyAtRevision(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	key := GetRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Create multiple versions
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	dataKey1 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey2 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv2,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}
	dataKey3 := DataKey{
		Group:           key.Group,
		Resource:        key.Resource,
		Namespace:       key.Namespace,
		Name:            key.Name,
		ResourceVersion: rv3,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey1, bytes.NewReader([]byte("version1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey2, bytes.NewReader([]byte("version2")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey3, bytes.NewReader([]byte("version3")))
	require.NoError(t, err)

	// Get key at rv2 should return rv2
	dataKey, err := ds.GetResourceKeyAtRevision(ctx, key, rv2)
	require.NoError(t, err)

	require.Equal(t, rv2, dataKey.ResourceVersion)
	require.Equal(t, DataActionUpdated, dataKey.Action)

	// Get key at rv1 should return rv1
	dataKey, err = ds.GetResourceKeyAtRevision(ctx, key, rv1)
	require.NoError(t, err)

	require.Equal(t, rv1, dataKey.ResourceVersion)
	require.Equal(t, DataActionCreated, dataKey.Action)

	// Get key at revision 0 should return latest (rv3)
	dataKey, err = ds.GetResourceKeyAtRevision(ctx, key, 0)
	require.NoError(t, err)

	require.Equal(t, rv3, dataKey.ResourceVersion)
	require.Equal(t, DataActionUpdated, dataKey.Action)
}

func TestDataStore_ListLatestResourceKeys(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Save multiple versions - ListLatestResourceKeys should return only the latest
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	dataKey1 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            listKey.Name,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey2 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            listKey.Name,
		ResourceVersion: rv2,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey1, bytes.NewReader([]byte("version1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey2, bytes.NewReader([]byte("version2")))
	require.NoError(t, err)

	// List latest resource keys
	resultKeys := make([]DataKey, 0, 1)
	for dataKey, err := range ds.ListLatestResourceKeys(ctx, listKey) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, dataKey)
	}

	require.Len(t, resultKeys, 1)
	require.Equal(t, dataKey2, resultKeys[0])
	require.Equal(t, rv2, resultKeys[0].ResourceVersion)
	require.Equal(t, DataActionUpdated, resultKeys[0].Action)
}

func TestDataStore_ListLatestResourceKeys_Deleted(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Save a resource and then delete it
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	dataKey1 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            listKey.Name,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey2 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            listKey.Name,
		ResourceVersion: rv2,
		Action:          DataActionDeleted,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey1, bytes.NewReader([]byte("version1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey2, bytes.NewReader([]byte("deleted")))
	require.NoError(t, err)

	// ListLatestResourceKeys should exclude deleted resources
	resultKeys := make([]DataKey, 0, 1)
	for dataKey, err := range ds.ListLatestResourceKeys(ctx, listKey) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, dataKey)
	}

	require.Len(t, resultKeys, 0) // Should be empty because resource was deleted
}

func TestDataStore_ListLatestResourceKeys_Multiple(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
	}

	// Save multiple resources with different names
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	dataKey1 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            "resource-1",
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey2 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            "resource-2",
		ResourceVersion: rv2,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	dataKey3 := DataKey{
		Group:           listKey.Group,
		Resource:        listKey.Resource,
		Namespace:       listKey.Namespace,
		Name:            "resource-1",
		ResourceVersion: rv3,
		Action:          DataActionUpdated,
		Folder:          "test-folder",
	}

	err := ds.Save(ctx, dataKey1, bytes.NewReader([]byte("resource-1-v1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey2, bytes.NewReader([]byte("resource-2-v1")))
	require.NoError(t, err)

	err = ds.Save(ctx, dataKey3, bytes.NewReader([]byte("resource-1-v2")))
	require.NoError(t, err)

	// List latest resource keys for all resources
	resultKeys := make([]DataKey, 0, 3)
	for dataKey, err := range ds.ListLatestResourceKeys(ctx, listKey) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, dataKey)
	}

	require.Len(t, resultKeys, 2) // resource-1 (latest version) and resource-2

	// Check we got the correct keys
	names := make(map[string]int64)
	for _, key := range resultKeys {
		names[key.Name] = key.ResourceVersion
	}

	require.Equal(t, rv3, names["resource-1"]) // Should be the updated version
	require.Equal(t, rv2, names["resource-2"])
}

func TestDataStore_ListResourceKeysAtRevision(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	// Create multiple resources with different versions
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()
	rv4 := node.Generate().Int64()
	rv5 := node.Generate().Int64()

	// Resource 1: Created at rv1, updated at rv3
	key1 := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "resource1",
		ResourceVersion: rv1,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	err := ds.Save(ctx, key1, bytes.NewReader([]byte("resource1-v1")))
	require.NoError(t, err)

	key1Updated := key1
	key1Updated.ResourceVersion = rv3
	key1Updated.Action = DataActionUpdated
	err = ds.Save(ctx, key1Updated, bytes.NewReader([]byte("resource1-v2")))
	require.NoError(t, err)

	// Resource 2: Created at rv2
	key2 := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "resource2",
		ResourceVersion: rv2,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	err = ds.Save(ctx, key2, bytes.NewReader([]byte("resource2-v1")))
	require.NoError(t, err)

	// Resource 3: Created at rv4
	key3 := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "resource3",
		ResourceVersion: rv4,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	err = ds.Save(ctx, key3, bytes.NewReader([]byte("resource3-v1")))
	require.NoError(t, err)

	// Resource 4: Created at rv2, deleted at rv5
	key4 := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "resource4",
		ResourceVersion: rv2,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	err = ds.Save(ctx, key4, bytes.NewReader([]byte("resource4-v1")))
	require.NoError(t, err)

	key4Deleted := key4
	key4Deleted.ResourceVersion = rv5
	key4Deleted.Action = DataActionDeleted
	err = ds.Save(ctx, key4Deleted, bytes.NewReader([]byte("resource4-deleted")))
	require.NoError(t, err)

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
	}

	t.Run("list at revision rv1 - should return only resource1 initial version", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 2)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv1) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 1)
		require.Equal(t, "resource1", resultKeys[0].Name)
		require.Equal(t, rv1, resultKeys[0].ResourceVersion)
		require.Equal(t, DataActionCreated, resultKeys[0].Action)
	})

	t.Run("list at revision rv2 - should return resource1, resource2 and resource4", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 3)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv2) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 3) // resource1, resource2, resource4
		names := make(map[string]int64)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
		}

		require.Equal(t, rv1, names["resource1"]) // Should be the original version
		require.Equal(t, rv2, names["resource2"])
		require.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv3 - should return resource1, resource2 and resource4", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 3)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv3) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource4
		names := make(map[string]int64)
		actions := make(map[string]DataAction)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
			actions[result.Name] = result.Action
		}

		require.Equal(t, rv3, names["resource1"]) // Should be the updated version
		require.Equal(t, DataActionUpdated, actions["resource1"])
		require.Equal(t, rv2, names["resource2"])
		require.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv4 - should return all resources", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 4)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv4) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 4) // resource1 (updated), resource2, resource3, resource4
		names := make(map[string]int64)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
		}

		require.Equal(t, rv3, names["resource1"])
		require.Equal(t, rv2, names["resource2"])
		require.Equal(t, rv4, names["resource3"])
		require.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv5 - should exclude deleted resource4", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 3)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv5) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource3 (resource4 excluded because deleted)
		names := make(map[string]bool)
		for _, result := range resultKeys {
			names[result.Name] = true
		}

		require.True(t, names["resource1"])
		require.True(t, names["resource2"])
		require.True(t, names["resource3"])
		require.False(t, names["resource4"]) // Should be excluded because it's deleted
	})

	t.Run("list with specific resource name", func(t *testing.T) {
		specificListKey := ListRequestKey{
			Group:     "apps",
			Resource:  "resources",
			Namespace: "default",
			Name:      "resource1",
		}

		resultKeys := make([]DataKey, 0, 2)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, specificListKey, rv3) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		require.Len(t, resultKeys, 1)
		require.Equal(t, "resource1", resultKeys[0].Name)
		require.Equal(t, rv3, resultKeys[0].ResourceVersion)
		require.Equal(t, DataActionUpdated, resultKeys[0].Action)
	})

	t.Run("list at revision 0 should use MaxInt64", func(t *testing.T) {
		resultKeys := make([]DataKey, 0, 4)
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, 0) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, dataKey)
		}

		// Should return all non-deleted resources at their latest versions
		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource3
		names := make(map[string]bool)
		for _, result := range resultKeys {
			names[result.Name] = true
		}

		require.True(t, names["resource1"])
		require.True(t, names["resource2"])
		require.True(t, names["resource3"])
		require.False(t, names["resource4"]) // Excluded because deleted
	})
}

func TestDataStore_ListResourceKeysAtRevision_ValidationErrors(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	tests := []struct {
		name string
		key  ListRequestKey
	}{
		{
			name: "missing group",
			key: ListRequestKey{
				Namespace: "default",
				Resource:  "resources",
			},
		},
		{
			name: "missing resource",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
			},
		},
		{
			name: "name without namespace",
			key: ListRequestKey{
				Group:    "apps",
				Resource: "resources",
				Name:     "test-name",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, err := range ds.ListResourceKeysAtRevision(ctx, tt.key, 0) {
				require.Error(t, err)
				return
			}
		})
	}
}

func TestDataStore_ListResourceKeysAtRevision_EmptyResults(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "empty",
	}

	resultKeys := make([]DataKey, 0, 1)
	for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, 0) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, dataKey)
	}

	require.Len(t, resultKeys, 0)
}

func TestDataStore_ListResourceKeysAtRevision_ResourcesNewerThanRevision(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	// Create a resource with a high resource version
	rv := node.Generate().Int64()
	key := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "future-resource",
		ResourceVersion: rv,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}
	err := ds.Save(ctx, key, bytes.NewReader([]byte("future-resource")))
	require.NoError(t, err)

	listKey := ListRequestKey{
		Group:     "apps",
		Resource:  "resources",
		Namespace: "default",
	}

	// List at a revision before the resource was created
	resultKeys := make([]DataKey, 0, 1)
	for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, listKey, rv-1000) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, dataKey)
	}

	// Should return no results since the resource is newer than the target revision
	require.Len(t, resultKeys, 0)
}

func TestDataKey_Equals(t *testing.T) {
	baseKey := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: 123,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}

	tests := []struct {
		name     string
		key1     DataKey
		key2     DataKey
		expected bool
	}{
		{
			name:     "identical keys",
			key1:     baseKey,
			key2:     baseKey,
			expected: true,
		},
		{
			name: "different resource version",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 456,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different action",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionUpdated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different folder",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "other-folder",
			},
			expected: false,
		},
		{
			name: "different namespace",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "other-namespace",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different group",
			key1: baseKey,
			key2: DataKey{
				Group:           "extensions",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different resource",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "services",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different name",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "other-deployment",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name:     "empty keys",
			key1:     DataKey{},
			key2:     DataKey{},
			expected: true,
		},
		{
			name:     "one empty key",
			key1:     baseKey,
			key2:     DataKey{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.key1.Equals(tt.key2)
			require.Equal(t, tt.expected, result)

			// Test symmetry: Equals should be commutative
			reverseResult := tt.key2.Equals(tt.key1)
			require.Equal(t, result, reverseResult, "Equals method should be commutative")
		})
	}
}

func TestDataKey_SameResource(t *testing.T) {
	baseKey := DataKey{
		Group:           "apps",
		Resource:        "resources",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: 123,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}

	tests := []struct {
		name     string
		key1     DataKey
		key2     DataKey
		expected bool
	}{
		{
			name:     "identical keys",
			key1:     baseKey,
			key2:     baseKey,
			expected: true,
		},
		{
			name: "same identifying fields, different resource version",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 456, // Different resource version
				Action:          DataActionUpdated,
				Folder:          "other-folder",
			},
			expected: true, // Should still be equal as ResourceVersion, Action, and Folder don't matter
		},
		{
			name: "different namespace",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "other-namespace",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different group",
			key1: baseKey,
			key2: DataKey{
				Group:           "extensions",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different resource",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "services",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different name",
			key1: baseKey,
			key2: DataKey{
				Group:           "apps",
				Resource:        "resources",
				Namespace:       "default",
				Name:            "other-deployment",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name:     "empty keys",
			key1:     DataKey{},
			key2:     DataKey{},
			expected: true,
		},
		{
			name:     "one empty key",
			key1:     baseKey,
			key2:     DataKey{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.key1.SameResource(tt.key2)
			require.Equal(t, tt.expected, result)

			// Test symmetry: SameResource should be commutative
			reverseResult := tt.key2.SameResource(tt.key1)
			require.Equal(t, result, reverseResult, "SameResource method should be commutative")
		})
	}
}

func TestGetRequestKey_Validate(t *testing.T) {
	tests := []struct {
		name      string
		key       GetRequestKey
		expectErr bool
		wantError string
	}{
		{
			name: "valid key",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "resources",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectErr: false,
		},
		{
			name: "valid key with dots and dashes",
			key: GetRequestKey{
				Group:     "apps.v1",
				Resource:  "deployment-configs",
				Namespace: "default-ns",
				Name:      "test-resource.v1",
			},
			expectErr: false,
		},
		{
			name: "missing group",
			key: GetRequestKey{
				Resource:  "resources",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectErr: true,
			wantError: "group is required",
		},
		{
			name: "missing resource",
			key: GetRequestKey{
				Group:     "apps",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectErr: true,
			wantError: "resource is required",
		},
		{
			name: "missing namespace",
			key: GetRequestKey{
				Group:    "apps",
				Resource: "resources",
				Name:     "test-resource",
			},
			expectErr: true,
			wantError: "namespace is required",
		},
		{
			name: "missing name",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "resources",
				Namespace: "default",
			},
			expectErr: true,
			wantError: "name is required",
		},
		{
			name: "invalid namespace - uppercase",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "resources",
				Namespace: "Default",
				Name:      "test-resource",
			},
			expectErr: true,
			wantError: "namespace 'Default' is invalid",
		},
		{
			name: "invalid group - underscore",
			key: GetRequestKey{
				Group:     "apps_v1",
				Resource:  "resources",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectErr: true,
			wantError: "group 'apps_v1' is invalid",
		},
		{
			name: "invalid resource - starts with dash",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "-resources",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectErr: true,
			wantError: "resource '-resources' is invalid",
		},
		{
			name: "invalid name - ends with dot",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "resources",
				Namespace: "default",
				Name:      "test-resource.",
			},
			expectErr: true,
			wantError: "name 'test-resource.' is invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			if tt.expectErr {
				require.Error(t, err)
				if tt.wantError != "" {
					require.Contains(t, err.Error(), tt.wantError)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGetRequestKey_Prefix(t *testing.T) {
	tests := []struct {
		name           string
		key            GetRequestKey
		expectedPrefix string
	}{
		{
			name: "standard key",
			key: GetRequestKey{
				Group:     "apps",
				Resource:  "resources",
				Namespace: "default",
				Name:      "test-resource",
			},
			expectedPrefix: "apps/resources/default/test-resource/",
		},
		{
			name: "key with special characters",
			key: GetRequestKey{
				Group:     "apps.v1",
				Resource:  "deployment-configs",
				Namespace: "system-namespace",
				Name:      "my-app.v2",
			},
			expectedPrefix: "apps.v1/deployment-configs/system-namespace/my-app.v2/",
		},
		{
			name: "key with single character fields",
			key: GetRequestKey{
				Group:     "a",
				Resource:  "b",
				Namespace: "c",
				Name:      "d",
			},
			expectedPrefix: "a/b/c/d/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix := tt.key.Prefix()
			require.Equal(t, tt.expectedPrefix, prefix)
		})
	}
}

func TestDataStore_GetResourceStats_Comprehensive(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	// Test setup: 3 namespaces × 3 groups × 3 resources × 3 names × 3 versions = 243 total entries
	// But each name will have only 1 latest version that counts, so 3 × 3 × 3 × 3 = 81 non-deleted resources
	namespaces := []string{"ns1", "ns2", "ns3"}
	groups := []string{"apps", "extensions", "networking"}
	resources := []string{"deployments", "services", "ingresses"}
	names := []string{"item1", "item2", "item3"}

	// Create all the test data
	totalEntries := 0
	for _, ns := range namespaces {
		for _, group := range groups {
			for _, resource := range resources {
				for _, name := range names {
					// Create 3 versions for each resource name
					for version := 1; version <= 3; version++ {
						rv := node.Generate().Int64()

						var action DataAction
						switch version {
						case 1:
							action = DataActionCreated
						case 2, 3:
							action = DataActionUpdated
						}

						dataKey := DataKey{
							Namespace:       ns,
							Group:           group,
							Resource:        resource,
							Name:            name,
							ResourceVersion: rv,
							Action:          action,
							Folder:          "test-folder",
						}

						content := fmt.Sprintf("%s/%s/%s/%s-v%d", ns, group, resource, name, version)
						err := ds.Save(ctx, dataKey, bytes.NewReader([]byte(content)))
						require.NoError(t, err)
						totalEntries++
					}
				}
			}
		}
	}

	// Verify we created the expected number of entries
	require.Equal(t, 243, totalEntries) // 3×3×3×3×3 = 243 total entries

	t.Run("get stats for all namespaces", func(t *testing.T) {
		stats, err := ds.GetResourceStats(ctx, "", 0)
		require.NoError(t, err)

		// Should have 27 resource types (3 namespaces × 3 groups × 3 resources)
		require.Len(t, stats, 27)

		// Each resource type should have exactly 3 items (3 names per resource type)
		for _, stat := range stats {
			require.Equal(t, int64(3), stat.Count, "Resource %s/%s/%s should have 3 items", stat.Namespace, stat.Group, stat.Resource)
			require.Greater(t, stat.ResourceVersion, int64(0), "ResourceVersion should be positive")
		}

		// Verify all expected combinations are present
		expectedCombinations := make(map[string]bool)
		for _, ns := range namespaces {
			for _, group := range groups {
				for _, resource := range resources {
					key := fmt.Sprintf("%s/%s/%s", ns, group, resource)
					expectedCombinations[key] = false
				}
			}
		}

		for _, stat := range stats {
			key := fmt.Sprintf("%s/%s/%s", stat.Namespace, stat.Group, stat.Resource)
			expectedCombinations[key] = true
		}

		for key, found := range expectedCombinations {
			require.True(t, found, "Expected combination not found: %s", key)
		}
	})

	t.Run("get stats for specific namespace ns1", func(t *testing.T) {
		stats, err := ds.GetResourceStats(ctx, "ns1", 0)
		require.NoError(t, err)

		// Should have 9 resource types (3 groups × 3 resources for ns1)
		require.Len(t, stats, 9)

		// All stats should be for ns1
		for _, stat := range stats {
			require.Equal(t, "ns1", stat.Namespace)
			require.Equal(t, int64(3), stat.Count) // 3 names per resource type
		}

		// Verify we have all expected groups and resources for ns1
		foundCombinations := make(map[string]bool)
		for _, stat := range stats {
			key := fmt.Sprintf("%s/%s", stat.Group, stat.Resource)
			foundCombinations[key] = true
		}

		expectedCount := len(groups) * len(resources) // 3×3=9
		require.Equal(t, expectedCount, len(foundCombinations))
	})

	t.Run("get stats for specific namespace ns2", func(t *testing.T) {
		stats, err := ds.GetResourceStats(ctx, "ns2", 0)
		require.NoError(t, err)

		// Should have 9 resource types (3 groups × 3 resources for ns2)
		require.Len(t, stats, 9)

		// All stats should be for ns2
		for _, stat := range stats {
			require.Equal(t, "ns2", stat.Namespace)
			require.Equal(t, int64(3), stat.Count)
		}
	})

	t.Run("get stats with minCount filter", func(t *testing.T) {
		// With minCount=0, all resources should be included (each has 3 items > 0)
		stats, err := ds.GetResourceStats(ctx, "", 0)
		require.NoError(t, err)
		require.Len(t, stats, 27) // All 27 resource types should be included

		// With minCount=2, all resources should still be included (each has 3 items > 2)
		stats, err = ds.GetResourceStats(ctx, "", 2)
		require.NoError(t, err)
		require.Len(t, stats, 27) // All 27 resource types should still be included

		// With minCount=3, no resources should be included (each has exactly 3 items, not > 3)
		stats, err = ds.GetResourceStats(ctx, "", 3)
		require.NoError(t, err)
		require.Len(t, stats, 0)

		// With minCount=4, no resources should be included (each has only 3 items < 4)
		stats, err = ds.GetResourceStats(ctx, "", 4)
		require.NoError(t, err)
		require.Len(t, stats, 0)
	})

	t.Run("get stats for non-existent namespace", func(t *testing.T) {
		stats, err := ds.GetResourceStats(ctx, "non-existent", 0)
		require.NoError(t, err)
		require.Len(t, stats, 0)
	})

	t.Run("add deleted resources and verify counts", func(t *testing.T) {
		// Delete one resource from ns1/apps/deployments/item1
		rv := node.Generate().Int64()
		deletedKey := DataKey{
			Namespace:       "ns1",
			Group:           "apps",
			Resource:        "deployments",
			Name:            "item1",
			ResourceVersion: rv,
			Action:          DataActionDeleted,
			Folder:          "test-folder",
		}

		err := ds.Save(ctx, deletedKey, bytes.NewReader([]byte("deleted")))
		require.NoError(t, err)

		// Get stats for ns1 - apps/deployments should now have 2 items instead of 3
		stats, err := ds.GetResourceStats(ctx, "ns1", 0)
		require.NoError(t, err)

		// Find the apps/deployments stat
		var appsDeploymentsCount int64 = -1
		for _, stat := range stats {
			if stat.Group == "apps" && stat.Resource == "deployments" {
				appsDeploymentsCount = stat.Count
				break
			}
		}

		require.Equal(t, int64(2), appsDeploymentsCount, "apps/deployments should have 2 items after deletion")

		// Other resource types in ns1 should still have 3 items
		otherResourceCount := 0
		for _, stat := range stats {
			if stat.Group != "apps" || stat.Resource != "deployments" {
				require.Equal(t, int64(3), stat.Count, "Other resources should still have 3 items")
				otherResourceCount++
			}
		}
		require.Equal(t, 8, otherResourceCount) // 9 total - 1 apps/deployments = 8
	})

	t.Run("verify resource versions are meaningful", func(t *testing.T) {
		stats, err := ds.GetResourceStats(ctx, "ns1", 0)
		require.NoError(t, err)

		// All ResourceVersions should be positive and reasonable
		for _, stat := range stats {
			require.Greater(t, stat.ResourceVersion, int64(0))
			// ResourceVersion should be a snowflake ID, so it should be quite large
			require.Greater(t, stat.ResourceVersion, int64(1000000))
		}
	})
}

func TestDataStore_getGroupResources(t *testing.T) {
	ds := setupTestDataStore(t)
	ctx := context.Background()

	// Create test data with multiple group/resource combinations
	testData := []struct {
		group     string
		resource  string
		namespace string
		name      string
	}{
		{"apps", "deployments", "default", "web-app"},
		{"apps", "deployments", "test", "api-server"},
		{"apps", "services", "default", "web-svc"},
		{"networking", "ingresses", "default", "web-ingress"},
		{"batch", "jobs", "default", "cleanup-job"},
		{"batch", "jobs", "test", "migration-job"},
	}

	// Save all test data
	for i, data := range testData {
		rv := node.Generate().Int64()
		dataKey := DataKey{
			Namespace:       data.namespace,
			Group:           data.group,
			Resource:        data.resource,
			Name:            data.name,
			ResourceVersion: rv,
			Action:          DataActionCreated,
			Folder:          "test-folder",
		}

		err := ds.Save(ctx, dataKey, bytes.NewReader([]byte(fmt.Sprintf("content-%d", i))))
		require.NoError(t, err)
	}

	// Test GetGroupResources
	results, err := ds.getGroupResources(ctx)
	require.NoError(t, err)

	// Should find exactly 4 unique group/resource combinations
	expectedCombinations := []string{
		"apps/deployments",
		"apps/services",
		"networking/ingresses",
		"batch/jobs",
	}

	require.Len(t, results, len(expectedCombinations))

	// Verify all expected combinations are present and no duplicates
	foundCombinations := make(map[string]bool)
	for _, result := range results {
		key := fmt.Sprintf("%s/%s", result.Group, result.Resource)
		require.False(t, foundCombinations[key], "Duplicate group/resource found: %s", key)
		foundCombinations[key] = true
	}

	for _, expected := range expectedCombinations {
		require.True(t, foundCombinations[expected], "Expected combination not found: %s", expected)
	}
}
