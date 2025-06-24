package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestMetadataStore(t *testing.T) *metadataStore {
	kv := setupTestKV(t)
	return newMetadataStore(kv)
}

func TestNewMetadataStore(t *testing.T) {
	store := setupTestMetadataStore(t)

	assert.NotNil(t, store)
}

func TestMetadataStore_GetKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	rv := int64(56500267212345678)
	key := MetaDataKey{
		Folder:          "test-folder",
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: rv,
		Action:          DataActionCreated,
	}

	expectedKey := "apps/resource/default/test-resource/56500267212345678~created~test-folder"
	actualKey := store.getKey(key)

	assert.Equal(t, expectedKey, actualKey)
}

func TestMetadataStore_ParseKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	rv := node.Generate()
	key := "apps/resource/default/test-resource/" + rv.String() + "~" + string(DataActionCreated) + "~test-folder"

	resourceKey, err := store.parseKey(key)

	require.NoError(t, err)
	assert.Equal(t, "apps", resourceKey.Group)
	assert.Equal(t, "resource", resourceKey.Resource)
	assert.Equal(t, "default", resourceKey.Namespace)
	assert.Equal(t, "test-resource", resourceKey.Name)
	assert.Equal(t, rv.Int64(), resourceKey.ResourceVersion)
	assert.Equal(t, DataActionCreated, resourceKey.Action)
	assert.Equal(t, "test-folder", resourceKey.Folder)
}

func TestMetadataStore_ParseKey_InvalidKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	tests := []struct {
		name string
		key  string
	}{
		{
			name: "too few parts",
			key:  "apps",
		},
		{
			name: "invalid uuid",
			key:  "apps/resource/default/test-resource/invalid-uuid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := store.parseKey(tt.key)
			assert.Error(t, err)
		})
	}
}

func TestMetadataStore_GetPrefix(t *testing.T) {
	store := setupTestMetadataStore(t)

	key := ListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
		Name:      "test-resource",
	}

	expectedPrefix := "apps/resource/default/test-resource/"
	actualPrefix, err := store.getPrefix(key)
	require.NoError(t, err)
	assert.Equal(t, expectedPrefix, actualPrefix)

	key.Name = ""
	expectedPrefix = "apps/resource/default/"
	actualPrefix, err = store.getPrefix(key)
	require.NoError(t, err)

	assert.Equal(t, expectedPrefix, actualPrefix)

	key.Group = ""
	_, err = store.getPrefix(key)
	require.Error(t, err)
}

func TestMetadataStore_Save(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionCreated,
	}

	metadata := MetaData{}

	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata,
	})
	require.NoError(t, err)
}

func TestMetadataStore_Get(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionCreated,
	}

	metadata := MetaData{
		IndexableDocument: IndexableDocument{
			Title:       "This is a test resource",
			Description: "This is a test resource description",
			Tags:        []string{"tag1", "tag2"},
			Labels: map[string]string{
				"label1": "label1",
				"label2": "label2",
			},
			Folder: "test-folder",
		},
	}

	// Save first
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata,
	})
	require.NoError(t, err)

	// Get it back
	retrievedMetadata, err := store.Get(ctx, key)
	require.NoError(t, err)

	assert.Equal(t, metadata, retrievedMetadata)
}

func TestMetadataStore_Get_NotFound(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionCreated,
	}

	_, err := store.Get(ctx, key)
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetLatest(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Create multiple versions with different timestamps
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	// Save multiple versions (uid3 should be latest)
	metadata1 := MetaData{
		IndexableDocument: IndexableDocument{
			Title: "Initial version",
		},
	}
	metadata2 := MetaData{
		IndexableDocument: IndexableDocument{
			Title: "Updated version",
		},
	}
	metadata3 := MetaData{
		IndexableDocument: IndexableDocument{
			Title: "Latest version",
		},
	}

	key.ResourceVersion = rv1
	key.Action = DataActionCreated
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata1,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv2
	key.Action = DataActionUpdated
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata2,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv3
	key.Action = DataActionCreated
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata3,
	})
	require.NoError(t, err)

	// Get latest should return uid3
	latestObj, err := store.GetLatest(ctx, ListRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	})
	require.NoError(t, err)

	assert.Equal(t, key, latestObj.Key)
	assert.Equal(t, metadata3, latestObj.Value)
}

func TestMetadataStore_GetLatest_Deleted(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionDeleted,
	}

	metadata := MetaData{}

	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata,
	})
	require.NoError(t, err)

	_, err = store.GetLatest(ctx, ListRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	})
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetLatest_ValidationErrors(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	tests := []struct {
		name string
		key  ListRequestKey
	}{
		{
			name: "missing namespace",
			key: ListRequestKey{
				Group:    "apps",
				Resource: "resource",
				Name:     "test-resource",
			},
		},
		{
			name: "missing group",
			key: ListRequestKey{
				Namespace: "default",
				Resource:  "resource",
				Name:      "test-resource",
			},
		},
		{
			name: "missing resource",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "test-resource",
			},
		},
		{
			name: "missing name",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := store.GetLatest(ctx, tt.key)
			assert.Error(t, err)
		})
	}
}

func TestMetadataStore_GetLatest_NoVersionsFound(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := ListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
		Name:      "test-resource",
	}

	_, err := store.GetLatest(ctx, key)
	assert.Error(t, err)
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_ListLatest(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Save multiple metadata objects
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	metadata1 := MetaData{}
	metadata2 := MetaData{}

	key.ResourceVersion = rv1
	key.Action = DataActionCreated
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata1,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv2
	key.Action = DataActionCreated
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata2,
	})
	require.NoError(t, err)

	// List latest metadata objects
	var results []MetaDataObj
	for obj, err := range store.ListLatest(ctx, ListRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}) {
		require.NoError(t, err)
		results = append(results, obj)
	}

	assert.Len(t, results, 1)
	assert.Equal(t, key, results[0].Key)
	assert.Equal(t, rv2, results[0].Key.ResourceVersion)
	assert.Equal(t, metadata2, results[0].Value)
}

func TestMetadataStore_ListAtRevision(t *testing.T) {
	store := newMetadataStore(setupTestKV(t))
	ctx := context.Background()

	// Create multiple resources with different versions
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()
	rv4 := node.Generate().Int64()
	rv5 := node.Generate().Int64()

	// Resource 1: Created at rv1, updated at rv3
	key1 := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "resource1",
		ResourceVersion: rv1,
		Action:          DataActionCreated,
	}
	metadata1 := MetaData{}
	err := store.Save(ctx, MetaDataObj{Key: key1, Value: metadata1})
	require.NoError(t, err)

	key1Updated := key1
	key1Updated.ResourceVersion = rv3
	key1Updated.Action = DataActionUpdated
	metadata1Updated := MetaData{}
	err = store.Save(ctx, MetaDataObj{Key: key1Updated, Value: metadata1Updated})
	require.NoError(t, err)

	// Resource 2: Created at rv2
	key2 := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "resource2",
		ResourceVersion: rv2,
		Action:          DataActionCreated,
	}
	metadata2 := MetaData{}
	err = store.Save(ctx, MetaDataObj{Key: key2, Value: metadata2})
	require.NoError(t, err)

	// Resource 3: Created at rv4
	key3 := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "resource3",
		ResourceVersion: rv4,
		Action:          DataActionCreated,
	}
	metadata3 := MetaData{}
	err = store.Save(ctx, MetaDataObj{Key: key3, Value: metadata3})
	require.NoError(t, err)

	// Resource 4: Created at rv2, deleted at rv5
	key4 := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "resource4",
		ResourceVersion: rv2,
		Action:          DataActionCreated,
	}
	metadata4 := MetaData{}
	err = store.Save(ctx, MetaDataObj{Key: key4, Value: metadata4})
	require.NoError(t, err)

	key4Deleted := key4
	key4Deleted.ResourceVersion = rv5
	key4Deleted.Action = DataActionDeleted
	err = store.Save(ctx, MetaDataObj{Key: key4Deleted, Value: metadata4})
	require.NoError(t, err)

	t.Run("list at revision rv1 - should return only resource1 initial version", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv1) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 1)
		assert.Equal(t, "resource1", results[0].Key.Name)
		assert.Equal(t, rv1, results[0].Key.ResourceVersion)
		assert.Equal(t, DataActionCreated, results[0].Key.Action)
	})

	t.Run("list at revision rv2 - should return resource1, resource2 and resource4", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv2) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 3) // resource1, resource2, resource4
		names := make(map[string]int64)
		for _, result := range results {
			names[result.Key.Name] = result.Key.ResourceVersion
		}

		assert.Equal(t, rv1, names["resource1"]) // Should be the original version
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv3 - should return resource1, resource2 and resource4", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv3) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 3) // resource1 (updated), resource2, resource4
		names := make(map[string]int64)
		actions := make(map[string]DataAction)
		for _, result := range results {
			names[result.Key.Name] = result.Key.ResourceVersion
			actions[result.Key.Name] = result.Key.Action
		}

		assert.Equal(t, rv3, names["resource1"]) // Should be the updated version
		assert.Equal(t, DataActionUpdated, actions["resource1"])
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv4 - should return", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv4) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 4) // resource1 (updated), resource2, resource3, resource4
		names := make(map[string]int64)
		for _, result := range results {
			names[result.Key.Name] = result.Key.ResourceVersion
		}

		assert.Equal(t, rv3, names["resource1"])
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv4, names["resource3"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv5 - should exclude deleted resource4", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv5) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 3) // resource1 (updated), resource2, resource3 (resource4 excluded because deleted)
		names := make(map[string]bool)
		for _, result := range results {
			names[result.Key.Name] = true
		}

		assert.True(t, names["resource1"])
		assert.True(t, names["resource2"])
		assert.True(t, names["resource3"])
		assert.False(t, names["resource4"]) // Should be excluded because it's deleted
	})

	t.Run("list with specific resource name", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
			Name:      "resource1",
		}, rv3) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		require.Len(t, results, 1)
		assert.Equal(t, "resource1", results[0].Key.Name)
		assert.Equal(t, rv3, results[0].Key.ResourceVersion)
		assert.Equal(t, DataActionUpdated, results[0].Key.Action)
	})

	t.Run("list at revision 0 should use MaxInt64", func(t *testing.T) {
		var results []MetaDataObj
		for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, 0) {
			require.NoError(t, err)
			results = append(results, obj)
		}

		// Should return all non-deleted resources at their latest versions
		require.Len(t, results, 3) // resource1 (updated), resource2, resource3
		names := make(map[string]bool)
		for _, result := range results {
			names[result.Key.Name] = true
		}

		assert.True(t, names["resource1"])
		assert.True(t, names["resource2"])
		assert.True(t, names["resource3"])
		assert.False(t, names["resource4"]) // Excluded because deleted
	})
}

func TestMetadataStore_ListAtRevision_ValidationErrors(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	tests := []struct {
		name string
		key  ListRequestKey
	}{
		{
			name: "missing group",
			key: ListRequestKey{
				Namespace: "default",
				Resource:  "resource",
			},
		},
		{
			name: "missing resource",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, err := range store.ListAtRevision(ctx, tt.key, 100) {
				assert.Error(t, err)
				break // Just check the first error
			}
		})
	}
}

func TestMetadataStore_ListAtRevision_EmptyResults(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	// List from empty store
	var results []MetaDataObj
	for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
	}, 1000) {
		require.NoError(t, err)
		results = append(results, obj)
	}

	assert.Len(t, results, 0)
}

func TestMetadataStore_ListAtRevision_ResourcesNewerThanRevision(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	// Create a resource with a high resource version
	rv := node.Generate().Int64()
	key := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "future-resource",
		ResourceVersion: rv,
		Action:          DataActionCreated,
	}
	metadata := MetaData{}
	err := store.Save(ctx, MetaDataObj{Key: key, Value: metadata})
	require.NoError(t, err)

	// List at a revision before the resource was created
	var results []MetaDataObj
	for obj, err := range store.ListAtRevision(ctx, ListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
	}, rv-1000) {
		require.NoError(t, err)
		results = append(results, obj)
	}

	// Should return no results since the resource is newer than the target revision
	assert.Len(t, results, 0)
}
