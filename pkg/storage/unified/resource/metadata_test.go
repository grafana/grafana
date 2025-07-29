package resource

import (
	"context"
	"encoding/json"
	"io"
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

func TestMetaDataKey_String(t *testing.T) {
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
	actualKey := key.String()

	assert.Equal(t, expectedKey, actualKey)
}

func TestParseMetaDataKey(t *testing.T) {
	rv := node.Generate()
	key := "apps/resource/default/test-resource/" + rv.String() + "~" + string(DataActionCreated) + "~test-folder"

	resourceKey, err := parseMetaDataKey(key)

	require.NoError(t, err)
	assert.Equal(t, "apps", resourceKey.Group)
	assert.Equal(t, "resource", resourceKey.Resource)
	assert.Equal(t, "default", resourceKey.Namespace)
	assert.Equal(t, "test-resource", resourceKey.Name)
	assert.Equal(t, rv.Int64(), resourceKey.ResourceVersion)
	assert.Equal(t, DataActionCreated, resourceKey.Action)
	assert.Equal(t, "test-folder", resourceKey.Folder)
}

func TestParseMetaDataKey_InvalidKey(t *testing.T) {
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
			_, err := parseMetaDataKey(tt.key)
			assert.Error(t, err)
		})
	}
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

	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata,
	})
	require.NoError(t, err)
	// Verify in the kv store that the metadata is saved
	reader, err := store.kv.Get(ctx, metaSection, key.String())
	require.NoError(t, err)
	var retrivedMeta MetaData
	actualData, err := io.ReadAll(reader)
	require.NoError(t, err)
	err = reader.Close()
	require.NoError(t, err)
	err = json.Unmarshal(actualData, &retrivedMeta)
	require.NoError(t, err)
	assert.Equal(t, metadata, retrivedMeta)
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

func TestMetadataStore_GetLatestResourceKey(t *testing.T) {
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

	// Save multiple versions (rv3 should be latest)
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

	// GetLatestKey should return rv3
	latestKey, err := store.GetLatestResourceKey(ctx, MetaGetRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	})
	require.NoError(t, err)

	assert.Equal(t, key, latestKey)
	assert.Equal(t, rv3, latestKey.ResourceVersion)
}

func TestMetadataStore_GetLatestKey_Deleted(t *testing.T) {
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

	_, err = store.GetLatestResourceKey(ctx, MetaGetRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	})
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetResourceKeyAtRevision(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
		Name:      "test-resource",
	}

	// Create multiple versions
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	metadata1 := MetaData{}
	metadata2 := MetaData{}
	metadata3 := MetaData{}

	key.ResourceVersion = rv1
	key.Action = DataActionCreated
	err := store.Save(ctx, MetaDataObj{Key: key, Value: metadata1})
	require.NoError(t, err)

	key.ResourceVersion = rv2
	key.Action = DataActionUpdated
	err = store.Save(ctx, MetaDataObj{Key: key, Value: metadata2})
	require.NoError(t, err)

	key.ResourceVersion = rv3
	key.Action = DataActionUpdated
	err = store.Save(ctx, MetaDataObj{Key: key, Value: metadata3})
	require.NoError(t, err)

	// Get key at rv2 should return rv2
	metaKey, err := store.GetResourceKeyAtRevision(ctx, MetaGetRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}, rv2)
	require.NoError(t, err)

	assert.Equal(t, rv2, metaKey.ResourceVersion)
	assert.Equal(t, DataActionUpdated, metaKey.Action)

	// Get key at rv1 should return rv1
	metaKey, err = store.GetResourceKeyAtRevision(ctx, MetaGetRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}, rv1)
	require.NoError(t, err)

	assert.Equal(t, rv1, metaKey.ResourceVersion)
	assert.Equal(t, DataActionCreated, metaKey.Action)
}

func TestMetadataStore_ListLatestResourceKeys(t *testing.T) {
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

	// List latest metadata keys
	resultKeys := make([]MetaDataKey, 0, 1)
	for metaKey, err := range store.ListLatestResourceKeys(ctx, MetaListRequestKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, metaKey)
	}

	assert.Len(t, resultKeys, 1)
	assert.Equal(t, key, resultKeys[0])
	assert.Equal(t, rv2, resultKeys[0].ResourceVersion)

	// Get the metadata to verify
	metadata, err := store.Get(ctx, resultKeys[0])
	require.NoError(t, err)
	assert.Equal(t, metadata2, metadata)
}

func TestMetadataStore_ListResourceKeysAtRevision(t *testing.T) {
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
		resultKeys := make([]MetaDataKey, 0, 1)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv1) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 1)
		assert.Equal(t, "resource1", resultKeys[0].Name)
		assert.Equal(t, rv1, resultKeys[0].ResourceVersion)
		assert.Equal(t, DataActionCreated, resultKeys[0].Action)
	})

	t.Run("list at revision rv2 - should return resource1, resource2 and resource4", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 3)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv2) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 3) // resource1, resource2, resource4
		names := make(map[string]int64)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
		}

		assert.Equal(t, rv1, names["resource1"]) // Should be the original version
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv3 - should return resource1, resource2 and resource4", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 3)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv3) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource4
		names := make(map[string]int64)
		actions := make(map[string]DataAction)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
			actions[result.Name] = result.Action
		}

		assert.Equal(t, rv3, names["resource1"]) // Should be the updated version
		assert.Equal(t, DataActionUpdated, actions["resource1"])
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv4 - should return", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 4)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv4) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 4) // resource1 (updated), resource2, resource3, resource4
		names := make(map[string]int64)
		for _, result := range resultKeys {
			names[result.Name] = result.ResourceVersion
		}

		assert.Equal(t, rv3, names["resource1"])
		assert.Equal(t, rv2, names["resource2"])
		assert.Equal(t, rv4, names["resource3"])
		assert.Equal(t, rv2, names["resource4"])
	})

	t.Run("list at revision rv5 - should exclude deleted resource4", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 3)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, rv5) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource3 (resource4 excluded because deleted)
		names := make(map[string]bool)
		for _, result := range resultKeys {
			names[result.Name] = true
		}

		assert.True(t, names["resource1"])
		assert.True(t, names["resource2"])
		assert.True(t, names["resource3"])
		assert.False(t, names["resource4"]) // Should be excluded because it's deleted
	})

	t.Run("list with specific resource name", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 1)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
			Name:      "resource1",
		}, rv3) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		require.Len(t, resultKeys, 1)
		assert.Equal(t, "resource1", resultKeys[0].Name)
		assert.Equal(t, rv3, resultKeys[0].ResourceVersion)
		assert.Equal(t, DataActionUpdated, resultKeys[0].Action)
	})

	t.Run("list at revision 0 should use MaxInt64", func(t *testing.T) {
		resultKeys := make([]MetaDataKey, 0, 3)
		for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
			Group:     "apps",
			Resource:  "resource",
			Namespace: "default",
		}, 0) {
			require.NoError(t, err)
			resultKeys = append(resultKeys, metaKey)
		}

		// Should return all non-deleted resources at their latest versions
		require.Len(t, resultKeys, 3) // resource1 (updated), resource2, resource3
		names := make(map[string]bool)
		for _, result := range resultKeys {
			names[result.Name] = true
		}

		assert.True(t, names["resource1"])
		assert.True(t, names["resource2"])
		assert.True(t, names["resource3"])
		assert.False(t, names["resource4"]) // Excluded because deleted
	})
}

func TestMetadataStore_ListResourceKeysAtRevision_ValidationErrors(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	tests := []struct {
		name string
		key  MetaListRequestKey
	}{
		{
			name: "missing namespace",
			key: MetaListRequestKey{
				Group:    "apps",
				Resource: "resource",
			},
		},
		{
			name: "missing group",
			key: MetaListRequestKey{
				Namespace: "default",
				Resource:  "resource",
			},
		},
		{
			name: "missing resource",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var resultKeys []MetaDataKey
			for metaKey, err := range store.ListResourceKeysAtRevision(ctx, tt.key, 0) {
				if err != nil {
					assert.Error(t, err)
					return
				}
				resultKeys = append(resultKeys, metaKey)
			}
		})
	}
}

func TestMetadataStore_ListResourceKeysAtRevision_EmptyResults(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	resultKeys := make([]MetaDataKey, 0, 1)
	for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
	}, 0) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, metaKey)
	}

	assert.Len(t, resultKeys, 0)
}

func TestMetadataStore_ListResourceKeysAtRevision_ResourcesNewerThanRevision(t *testing.T) {
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
	resultKeys := make([]MetaDataKey, 0, 1)
	for metaKey, err := range store.ListResourceKeysAtRevision(ctx, MetaListRequestKey{
		Group:     "apps",
		Resource:  "resource",
		Namespace: "default",
	}, rv-1000) {
		require.NoError(t, err)
		resultKeys = append(resultKeys, metaKey)
	}

	// Should return no results since the resource is newer than the target revision
	assert.Len(t, resultKeys, 0)
}

func TestMetaDataKey_Validate_Valid(t *testing.T) {
	validKey := MetaDataKey{
		Group:           "apps",
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: 123,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}

	err := validKey.Validate()
	assert.NoError(t, err)
}

func TestMetaDataKey_Validate_ValidEdgeCases(t *testing.T) {
	tests := []struct {
		name string
		key  MetaDataKey
	}{
		{
			name: "valid with empty folder",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "", // empty folder should be allowed
			},
		},
		{
			name: "valid with single character names",
			key: MetaDataKey{
				Group:           "a",
				Resource:        "r",
				Namespace:       "n",
				Name:            "t",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "f",
			},
		},
		{
			name: "valid with hyphens and dots",
			key: MetaDataKey{
				Group:           "my-group.v1",
				Resource:        "my-resource.v2",
				Namespace:       "my-namespace.test",
				Name:            "my-name.test",
				ResourceVersion: 123,
				Action:          DataActionUpdated,
				Folder:          "my-folder.test",
			},
		},
		{
			name: "valid with all action types",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionDeleted,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			assert.NoError(t, err)
		})
	}
}

func TestMetaDataKey_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name      string
		key       MetaDataKey
		wantError string
	}{
		{
			name: "empty group",
			key: MetaDataKey{
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "group is required",
		},
		{
			name: "empty resource",
			key: MetaDataKey{
				Group:           "apps",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "resource is required",
		},
		{
			name: "empty namespace",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "namespace is required",
		},
		{
			name: "empty name",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "name is required",
		},
		{
			name: "zero resource version",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 0,
				Action:          DataActionCreated,
			},
			wantError: "resource version must be positive",
		},
		{
			name: "negative resource version",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: -1,
				Action:          DataActionCreated,
			},
			wantError: "resource version must be positive",
		},
		{
			name: "empty action",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
			},
			wantError: "action is required",
		},
		{
			name: "invalid name with uppercase",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "Test-Resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "name 'Test-Resource' is invalid",
		},
		{
			name: "invalid namespace with special chars",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default_ns",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "namespace 'default_ns' is invalid",
		},
		{
			name: "invalid group with uppercase",
			key: MetaDataKey{
				Group:           "Apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "group 'Apps' is invalid",
		},
		{
			name: "invalid resource with special chars",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource_type",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
			},
			wantError: "resource 'resource_type' is invalid",
		},
		{
			name: "invalid folder with special chars",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "invalid_folder",
			},
			wantError: "folder 'invalid_folder' is invalid",
		},
		{
			name: "invalid action",
			key: MetaDataKey{
				Group:           "apps",
				Resource:        "resource",
				Namespace:       "default",
				Name:            "test-resource",
				ResourceVersion: 123,
				Action:          "invalid",
			},
			wantError: "action 'invalid' is invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantError)
		})
	}
}

func TestMetaDataKey_SameResource(t *testing.T) {
	baseKey := MetaDataKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		ResourceVersion: 123,
		Action:          DataActionCreated,
		Folder:          "test-folder",
	}

	tests := []struct {
		name     string
		key1     MetaDataKey
		key2     MetaDataKey
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
			key2: MetaDataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
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
			key2: MetaDataKey{
				Namespace:       "other-namespace",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-Resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different group",
			key1: baseKey,
			key2: MetaDataKey{
				Namespace:       "default",
				Group:           "extensions",
				Resource:        "resource",
				Name:            "test-Resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different resource",
			key1: baseKey,
			key2: MetaDataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "daemonsets",
				Name:            "test-Resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name: "different name",
			key1: baseKey,
			key2: MetaDataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "other-Resource",
				ResourceVersion: 123,
				Action:          DataActionCreated,
				Folder:          "test-folder",
			},
			expected: false,
		},
		{
			name:     "empty keys",
			key1:     MetaDataKey{},
			key2:     MetaDataKey{},
			expected: true,
		},
		{
			name:     "one empty key",
			key1:     baseKey,
			key2:     MetaDataKey{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.key1.SameResource(tt.key2)
			assert.Equal(t, tt.expected, result)

			// Test symmetry: SameResource should be commutative
			reverseResult := tt.key2.SameResource(tt.key1)
			assert.Equal(t, result, reverseResult, "SameResource method should be commutative")
		})
	}
}

func TestMetadataStore_Save_InvalidKey(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "", // invalid: empty group
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
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid metadata key")
	assert.Contains(t, err.Error(), "group is required")
}

func TestMetadataStore_Get_InvalidKey(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:           "", // invalid: empty group
		Resource:        "resource",
		Namespace:       "default",
		Name:            "test-resource",
		ResourceVersion: node.Generate().Int64(),
		Action:          DataActionCreated,
	}

	_, err := store.Get(ctx, key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid metadata key")
	assert.Contains(t, err.Error(), "group is required")
}

func TestMetaListRequestKey_Validate(t *testing.T) {
	tests := []struct {
		name      string
		key       MetaListRequestKey
		expectErr bool
	}{
		{
			name: "valid key with all fields",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
				Name:      "test-resource",
			},
			expectErr: false,
		},
		{
			name: "valid key without name (for listing multiple resources)",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			expectErr: false,
		},
		{
			name: "invalid key: name provided when namespace is empty",
			key: MetaListRequestKey{
				Group:    "apps",
				Resource: "resource",
				Name:     "test-resource",
			},
			expectErr: true,
		},
		{
			name: "valid key with empty namespace and no name",
			key: MetaListRequestKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			expectErr: false,
		},
		{
			name: "missing group",
			key: MetaListRequestKey{
				Namespace: "default",
				Resource:  "resource",
				Name:      "test-Resource",
			},
			expectErr: true,
		},
		{
			name: "missing resource",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "test-Resource",
			},
			expectErr: true,
		},
		{
			name: "invalid namespace",
			key: MetaListRequestKey{
				Namespace: "Default",
				Group:     "apps",
				Resource:  "resource",
			},
			expectErr: true,
		},
		{
			name: "invalid name",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
				Name:      "Test-Resource",
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMetaGetRequestKey_Validate(t *testing.T) {
	tests := []struct {
		name      string
		key       MetaGetRequestKey
		expectErr bool
	}{
		{
			name: "valid key",
			key: MetaGetRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
				Name:      "test-resource",
			},
			expectErr: false,
		},
		{
			name: "missing namespace",
			key: MetaGetRequestKey{
				Group:    "apps",
				Resource: "resource",
				Name:     "test-	",
			},
			expectErr: true,
		},
		{
			name: "missing group",
			key: MetaGetRequestKey{
				Namespace: "default",
				Resource:  "resource",
				Name:      "test-	",
			},
			expectErr: true,
		},
		{
			name: "missing resource",
			key: MetaGetRequestKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "test-	",
			},
			expectErr: true,
		},
		{
			name: "missing name",
			key: MetaGetRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			expectErr: true,
		},
		{
			name: "invalid namespace",
			key: MetaGetRequestKey{
				Namespace: "Default",
				Group:     "apps",
				Resource:  "resource",
				Name:      "test-	",
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMetaListRequestKey_Prefix(t *testing.T) {
	tests := []struct {
		name           string
		key            MetaListRequestKey
		expectedPrefix string
	}{
		{
			name: "full key with name",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
				Name:      "test-resource",
			},
			expectedPrefix: "apps/resource/default/test-resource/",
		},
		{
			name: "key without name",
			key: MetaListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			expectedPrefix: "apps/resource/default/",
		},
		{
			name: "key without namespace and without name",
			key: MetaListRequestKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			expectedPrefix: "apps/resource/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix := tt.key.Prefix()
			assert.Equal(t, tt.expectedPrefix, prefix)
		})
	}
}

func TestMetaGetRequestKey_Prefix(t *testing.T) {
	key := MetaGetRequestKey{
		Namespace: "default",
		Group:     "apps",
		Resource:  "resource",
		Name:      "test-	",
	}

	expectedPrefix := "apps/resource/default/test-	/"
	prefix := key.Prefix()
	assert.Equal(t, expectedPrefix, prefix)
}
