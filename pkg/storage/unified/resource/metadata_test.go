package resource

import (
	"context"
	"testing"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var node, _ = snowflake.NewNode(1)

func setupTestKV(t *testing.T) KV {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		db.Close()
	})
	return NewBadgerKV(db)
}

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
		Group:           "apps",
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "test-deployment",
		ResourceVersion: rv,
		Action:          MetaDataActionCreated,
	}

	expectedKey := "apps/deployments/default/test-deployment/56500267212345678~created"
	actualKey := store.getKey(key)

	assert.Equal(t, expectedKey, actualKey)
}

func TestMetadataStore_ParseKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	rv := node.Generate()
	key := "apps/deployments/default/test-deployment/" + rv.String() + "~" + string(MetaDataActionCreated)

	resourceKey, err := store.parseKey(key)

	require.NoError(t, err)
	assert.Equal(t, "apps", resourceKey.Group)
	assert.Equal(t, "deployments", resourceKey.Resource)
	assert.Equal(t, "default", resourceKey.Namespace)
	assert.Equal(t, "test-deployment", resourceKey.Name)
	assert.Equal(t, rv.Int64(), resourceKey.ResourceVersion)
	assert.Equal(t, MetaDataActionCreated, resourceKey.Action)
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
			key:  "apps/deployments/default/test-deployment/invalid-uuid",
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
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	expectedPrefix := "apps/deployments/default/test-deployment/"
	actualPrefix, err := store.getPrefix(key)
	require.NoError(t, err)
	assert.Equal(t, expectedPrefix, actualPrefix)

	key.Name = ""
	expectedPrefix = "apps/deployments/default/"
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
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "test-deployment",
		ResourceVersion: node.Generate().Int64(),
		Action:          MetaDataActionCreated,
	}

	metadata := MetaData{
		Folder: "test-folder",
	}

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
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "test-deployment",
		ResourceVersion: node.Generate().Int64(),
		Action:          MetaDataActionCreated,
	}

	metadata := MetaData{
		Folder: "test-folder",
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
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "test-deployment",
		ResourceVersion: node.Generate().Int64(),
		Action:          MetaDataActionCreated,
	}

	_, err := store.Get(ctx, key)
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetLatest(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := MetaDataKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	// Create multiple versions with different timestamps
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	rv3 := node.Generate().Int64()

	// Save multiple versions (uid3 should be latest)
	metadata1 := MetaData{Folder: "folder1"}
	metadata2 := MetaData{Folder: "folder2"}
	metadata3 := MetaData{Folder: "folder3"}

	key.ResourceVersion = rv1
	key.Action = MetaDataActionCreated
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata1,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv2
	key.Action = MetaDataActionUpdated
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata2,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv3
	key.Action = MetaDataActionCreated
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
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "test-deployment",
		ResourceVersion: node.Generate().Int64(),
		Action:          MetaDataActionDeleted,
	}

	metadata := MetaData{
		Folder: "test-folder",
	}

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
				Resource: "deployments",
				Name:     "test-deployment",
			},
		},
		{
			name: "missing group",
			key: ListRequestKey{
				Namespace: "default",
				Resource:  "deployments",
				Name:      "test-deployment",
			},
		},
		{
			name: "missing resource",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "test-deployment",
			},
		},
		{
			name: "missing name",
			key: ListRequestKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "deployments",
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
	db := setupTestBadgerDB(t)
	defer db.Close()

	kv := NewBadgerKV(db)
	store := newMetadataStore(kv)
	ctx := context.Background()

	key := ListRequestKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	_, err := store.GetLatest(ctx, key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "key not found")
}

func TestMetadataStore_ListAll(t *testing.T) {
	store := newMetadataStore(setupTestKV(t))
	ctx := context.Background()

	// Save multiple metadata objects
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	key1 := MetaDataKey{
		Group:           "apps",
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "deployment1",
		ResourceVersion: rv1,
		Action:          MetaDataActionCreated,
	}

	key2 := MetaDataKey{
		Group:           "apps",
		Resource:        "deployments",
		Namespace:       "default",
		Name:            "deployment2",
		ResourceVersion: rv2,
		Action:          MetaDataActionCreated,
	}

	metadata1 := MetaData{Folder: "folder1"}
	metadata2 := MetaData{Folder: "folder2"}

	err := store.Save(ctx, MetaDataObj{
		Key:   key1,
		Value: metadata1,
	})
	require.NoError(t, err)
	err = store.Save(ctx, MetaDataObj{
		Key:   key2,
		Value: metadata2,
	})
	require.NoError(t, err)

	// List all metadata objects
	var results []MetaDataObj
	for obj, err := range store.ListAll(ctx, ListRequestKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "", // Empty name for listing
	}) {
		require.NoError(t, err)
		results = append(results, obj)
	}

	assert.Len(t, results, 2)

	// Check that both objects are present
	foundNames := make(map[string]bool)
	for _, result := range results {
		foundNames[result.Key.Name] = true
	}

	assert.True(t, foundNames["deployment1"])
	assert.True(t, foundNames["deployment2"])
}

func TestMetadataStore_ListLatest(t *testing.T) {
	store := newMetadataStore(setupTestKV(t))
	ctx := context.Background()

	key := MetaDataKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	// Save multiple metadata objects
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	metadata1 := MetaData{Folder: "folder1"}
	metadata2 := MetaData{Folder: "folder2"}

	key.ResourceVersion = rv1
	key.Action = MetaDataActionCreated
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		Value: metadata1,
	})
	require.NoError(t, err)

	key.ResourceVersion = rv2
	key.Action = MetaDataActionCreated
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

func TestPrefixRangeEnd(t *testing.T) {
	prefix := "/unified/meta/apps/"
	expected := "/unified/meta/apps0" // '/' + 1 = '0'

	result := PrefixRangeEnd(prefix)
	assert.Equal(t, expected, result)
}
