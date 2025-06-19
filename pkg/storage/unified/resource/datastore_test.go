package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDataStore(t *testing.T) *dataStore {
	kv := setupTestKV(t)
	return newDataStore(kv)
}

func TestNewDataStore(t *testing.T) {
	ds := setupTestDataStore(t)
	assert.NotNil(t, ds)
}

func TestDataStore_GetPrefix(t *testing.T) {
	ds := setupTestDataStore(t)

	key := ListRequestKey{
		Namespace: "test-namespace",
		Group:     "test-group",
		Resource:  "test-resource",
		Name:      "test-name",
	}

	expected := "test-namespace/test-group/test-resource/test-name/"
	actual, err := ds.getPrefix(key)

	assert.NoError(t, err)
	assert.Equal(t, expected, actual)

	key.Name = ""
	expected = "test-namespace/test-group/test-resource/"
	actual, err = ds.getPrefix(key)
	assert.NoError(t, err)
	assert.Equal(t, expected, actual)

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
				Action:          MetaDataActionCreated,
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
				Action:          MetaDataActionUpdated,
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
				Action:          MetaDataActionDeleted,
			},
			expected: "test-namespace/test-group/test-resource/test-name/1934555792099250176~deleted",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := ds.getKey(tt.key)
			assert.Equal(t, tt.expected, actual)
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
				Action:          MetaDataActionCreated,
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
				Action:          MetaDataActionDeleted,
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
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, actual)
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
		Action:          MetaDataActionCreated,
	}
	testValue := []byte("test-value")

	t.Run("save and get normal key", func(t *testing.T) {
		err := ds.Save(ctx, testKey, testValue)
		require.NoError(t, err)

		result, err := ds.Get(ctx, testKey)
		require.NoError(t, err)
		assert.Equal(t, testValue, result)
	})

	t.Run("save and get deleted key", func(t *testing.T) {
		deletedKey := testKey
		deletedKey.Action = MetaDataActionDeleted
		deletedValue := []byte("deleted-value")

		err := ds.Save(ctx, deletedKey, deletedValue)
		require.NoError(t, err)

		result, err := ds.Get(ctx, deletedKey)
		require.NoError(t, err)
		assert.Equal(t, deletedValue, result)
	})

	t.Run("get non-existent key", func(t *testing.T) {
		rv := node.Generate()

		nonExistentKey := DataKey{
			Namespace:       "non-existent",
			Group:           "test-group",
			Resource:        "test-resource",
			Name:            "test-name",
			ResourceVersion: rv.Int64(),
			Action:          MetaDataActionCreated,
		}

		_, err := ds.Get(ctx, nonExistentKey)
		assert.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
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
		Action:          MetaDataActionCreated,
	}
	testValue := []byte("test-value")

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
		assert.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("delete non-existent key", func(t *testing.T) {
		nonExistentKey := DataKey{
			Namespace:       "non-existent",
			Group:           "test-group",
			Resource:        "test-resource",
			Name:            "test-name",
			ResourceVersion: rv.Int64(),
			Action:          MetaDataActionCreated,
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
	testValue1 := []byte("test-value-1")
	testValue2 := []byte("test-value-2")

	dataKey1 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv1.Int64(),
		Action:          MetaDataActionCreated,
	}

	dataKey2 := DataKey{
		Namespace:       resourceKey.Namespace,
		Group:           resourceKey.Group,
		Resource:        resourceKey.Resource,
		Name:            resourceKey.Name,
		ResourceVersion: rv2.Int64(),
		Action:          MetaDataActionCreated,
	}

	t.Run("list multiple keys", func(t *testing.T) {
		// Save test data
		err := ds.Save(ctx, dataKey1, testValue1)
		require.NoError(t, err)

		err = ds.Save(ctx, dataKey2, testValue2)
		require.NoError(t, err)

		// List the data
		var results []DataObj
		for obj, err := range ds.List(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		// Verify results
		require.Len(t, results, 2)

		// Create a map for easier verification
		resultMap := make(map[int64]DataObj)
		for _, result := range results {
			resultMap[result.Key.ResourceVersion] = result
		}

		// Check first result
		result1, exists := resultMap[rv1.Int64()]
		require.True(t, exists)
		assert.Equal(t, testValue1, result1.Value)
		assert.Equal(t, rv1.Int64(), result1.Key.ResourceVersion)
		assert.Equal(t, resourceKey.Namespace, result1.Key.Namespace)
		assert.Equal(t, resourceKey.Group, result1.Key.Group)
		assert.Equal(t, resourceKey.Resource, result1.Key.Resource)
		assert.Equal(t, MetaDataActionCreated, result1.Key.Action)

		// Check second result
		result2, exists := resultMap[rv2.Int64()]
		require.True(t, exists)
		assert.Equal(t, testValue2, result2.Value)
		assert.Equal(t, rv2.Int64(), result2.Key.ResourceVersion)
		assert.Equal(t, resourceKey.Namespace, result2.Key.Namespace)
		assert.Equal(t, resourceKey.Group, result2.Key.Group)
		assert.Equal(t, resourceKey.Resource, result2.Key.Resource)
		assert.Equal(t, MetaDataActionCreated, result2.Key.Action)
	})

	t.Run("list empty", func(t *testing.T) {
		emptyResourceKey := ListRequestKey{
			Namespace: "empty-namespace",
			Group:     "empty-group",
			Resource:  "empty-resource",
			Name:      "empty-name",
		}

		var results []DataObj
		for obj, err := range ds.List(ctx, emptyResourceKey) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		assert.Len(t, results, 0)
	})

	t.Run("list with deleted keys", func(t *testing.T) {
		deletedResourceKey := ListRequestKey{
			Namespace: "deleted-namespace",
			Group:     "deleted-group",
			Resource:  "deleted-resource",
			Name:      "deleted-name",
		}

		rv3 := node.Generate()
		testValue3 := []byte("deleted-value")

		deletedKey := DataKey{
			Namespace:       deletedResourceKey.Namespace,
			Group:           deletedResourceKey.Group,
			Resource:        deletedResourceKey.Resource,
			Name:            deletedResourceKey.Name,
			ResourceVersion: rv3.Int64(),
			Action:          MetaDataActionDeleted,
		}

		// Save deleted key
		err := ds.Save(ctx, deletedKey, testValue3)
		require.NoError(t, err)

		// List should include deleted keys
		var results []DataObj
		for obj, err := range ds.List(ctx, deletedResourceKey) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 1)
		assert.Equal(t, testValue3, results[0].Value)
		assert.Equal(t, rv3.Int64(), results[0].Key.ResourceVersion)
		assert.Equal(t, MetaDataActionDeleted, results[0].Key.Action)
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
			value []byte
		}{
			{rv1.Int64(), []byte("version-1")},
			{rv2.Int64(), []byte("version-2")},
			{rv3.Int64(), []byte("version-3")},
		}

		// Save all versions
		for _, version := range versions {
			dataKey := DataKey{
				Namespace:       resourceKey.Namespace,
				Group:           resourceKey.Group,
				Resource:        resourceKey.Resource,
				Name:            resourceKey.Name,
				ResourceVersion: version.rv,
				Action:          MetaDataActionUpdated,
			}

			err := ds.Save(ctx, dataKey, version.value)
			require.NoError(t, err)
		}

		// List all versions
		var results []DataObj
		for obj, err := range ds.List(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		assert.Len(t, results, 3)

		// Delete one version
		deleteKey := DataKey{
			Namespace:       resourceKey.Namespace,
			Group:           resourceKey.Group,
			Resource:        resourceKey.Resource,
			Name:            resourceKey.Name,
			ResourceVersion: versions[1].rv,
			Action:          MetaDataActionUpdated,
		}

		err := ds.Delete(ctx, deleteKey)
		require.NoError(t, err)

		// Verify it's gone
		_, err = ds.Get(ctx, deleteKey)
		assert.Equal(t, ErrNotFound, err)

		// List should now have 2 items
		results = nil
		for obj, err := range ds.List(ctx, resourceKey) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		assert.Len(t, results, 2)

		// Verify remaining items
		remainingUUIDs := make(map[int64]bool)
		for _, result := range results {
			remainingUUIDs[result.Key.ResourceVersion] = true
		}

		assert.True(t, remainingUUIDs[versions[0].rv])
		assert.False(t, remainingUUIDs[versions[1].rv]) // deleted
		assert.True(t, remainingUUIDs[versions[2].rv])
	})
}
