package resource

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	uid := uuid.New()

	expectedKey := "/unified/meta/apps/deployments/default/test-deployment/" + uid.String()
	actualKey := store.getKey(key, uid)

	assert.Equal(t, expectedKey, actualKey)
}

func TestMetadataStore_ParseKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	uid := uuid.New()
	key := "/unified/meta/apps/deployments/default/test-deployment/" + uid.String()

	resourceKey, parsedUID, err := store.parseKey(key)

	require.NoError(t, err)
	assert.Equal(t, "apps", resourceKey.Group)
	assert.Equal(t, "deployments", resourceKey.Resource)
	assert.Equal(t, "default", resourceKey.Namespace)
	assert.Equal(t, "test-deployment", resourceKey.Name)
	assert.Equal(t, uid, parsedUID)
}

func TestMetadataStore_ParseKey_InvalidKey(t *testing.T) {
	store := setupTestMetadataStore(t)

	tests := []struct {
		name string
		key  string
	}{
		{
			name: "too few parts",
			key:  "/unified/meta/apps",
		},
		{
			name: "invalid uuid",
			key:  "/unified/meta/apps/deployments/default/test-deployment/invalid-uuid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := store.parseKey(tt.key)
			assert.Error(t, err)
		})
	}
}

func TestMetadataStore_GetPrefix(t *testing.T) {
	store := setupTestMetadataStore(t)

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	expectedPrefix := "/unified/meta/apps/deployments/default/test-deployment/"
	actualPrefix, err := store.getPrefix(key)
	require.NoError(t, err)
	assert.Equal(t, expectedPrefix, actualPrefix)

	key.Name = ""
	expectedPrefix = "/unified/meta/apps/deployments/default/"
	actualPrefix, err = store.getPrefix(key)
	require.NoError(t, err)

	assert.Equal(t, expectedPrefix, actualPrefix)

	key.Namespace = ""
	_, err = store.getPrefix(key)
	require.Error(t, err)

	key.Group = ""
	_, err = store.getPrefix(key)
	require.Error(t, err)
}

func TestMetadataStore_Save(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	err := store.Save(ctx, MetaDataObj{
		Key: key,
		UID: uuid.New(),
		Value: MetaData{
			Folder:  "test-folder",
			Deleted: false,
		},
	})
	require.NoError(t, err)
}

func TestMetadataStore_Get(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	uid := uuid.New()
	metadata := MetaData{
		Folder:  "test-folder",
		Deleted: false,
	}

	// Save first
	err := store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid,
		Value: metadata,
	})
	require.NoError(t, err)

	// Get it back
	retrievedMetadata, err := store.Get(ctx, key, uid)
	require.NoError(t, err)

	assert.Equal(t, metadata, retrievedMetadata)
}

func TestMetadataStore_Get_NotFound(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	uid := uuid.New()

	_, err := store.Get(ctx, key, uid)
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetLatest(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	// Create multiple versions with different timestamps
	uid1, err := uuid.NewV7()
	require.NoError(t, err)

	uid2, err := uuid.NewV7()
	require.NoError(t, err)

	uid3, err := uuid.NewV7()
	require.NoError(t, err)

	// Save multiple versions (uid3 should be latest)
	metadata1 := MetaData{Folder: "folder1", Deleted: false}
	metadata2 := MetaData{Folder: "folder2", Deleted: false}
	metadata3 := MetaData{Folder: "folder3", Deleted: false}

	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid1,
		Value: metadata1,
	})
	require.NoError(t, err)
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid2,
		Value: metadata2,
	})
	require.NoError(t, err)
	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid3,
		Value: metadata3,
	})
	require.NoError(t, err)

	// Get latest should return uid3
	latestObj, err := store.GetLatest(ctx, key)
	require.NoError(t, err)

	assert.Equal(t, key, latestObj.Key)
	assert.Equal(t, uid3, latestObj.UID)
	assert.Equal(t, metadata3, latestObj.Value)
}

func TestMetadataStore_GetLatest_Deleted(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	metadata := MetaData{
		Folder:  "test-folder",
		Deleted: true, // Marked as deleted
	}
	uid, err := uuid.NewV7()
	require.NoError(t, err)

	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid,
		Value: metadata,
	})
	require.NoError(t, err)

	_, err = store.GetLatest(ctx, key)
	assert.Equal(t, ErrNotFound, err)
}

func TestMetadataStore_GetLatest_ValidationErrors(t *testing.T) {
	store := setupTestMetadataStore(t)
	ctx := context.Background()

	tests := []struct {
		name string
		key  resourcepb.ResourceKey
	}{
		{
			name: "missing namespace",
			key: resourcepb.ResourceKey{
				Group:    "apps",
				Resource: "deployments",
				Name:     "test-deployment",
			},
		},
		{
			name: "missing group",
			key: resourcepb.ResourceKey{
				Namespace: "default",
				Resource:  "deployments",
				Name:      "test-deployment",
			},
		},
		{
			name: "missing resource",
			key: resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "test-deployment",
			},
		},
		{
			name: "missing name",
			key: resourcepb.ResourceKey{
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

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	_, err := store.GetLatest(ctx, key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no latest version found")
}

func TestMetadataStore_ListAll(t *testing.T) {
	store := newMetadataStore(setupTestKV(t))
	ctx := context.Background()

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "", // Empty name for listing
	}

	// Save multiple metadata objects
	uid1, err := uuid.NewV7()
	require.NoError(t, err)
	uid2, err := uuid.NewV7()
	require.NoError(t, err)

	key1 := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "deployment1",
	}

	key2 := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "deployment2",
	}

	metadata1 := MetaData{Folder: "folder1", Deleted: false}
	metadata2 := MetaData{Folder: "folder2", Deleted: false}

	err = store.Save(ctx, MetaDataObj{
		Key:   key1,
		UID:   uid1,
		Value: metadata1,
	})
	require.NoError(t, err)
	err = store.Save(ctx, MetaDataObj{
		Key:   key2,
		UID:   uid2,
		Value: metadata2,
	})
	require.NoError(t, err)

	// List all metadata objects
	var results []MetaDataObj
	for obj, err := range store.ListAll(ctx, key) {
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

	key := resourcepb.ResourceKey{
		Group:     "apps",
		Resource:  "deployments",
		Namespace: "default",
		Name:      "test-deployment",
	}

	// Save multiple metadata objects
	uid1, err := uuid.NewV7()
	require.NoError(t, err)
	uid2, err := uuid.NewV7()
	require.NoError(t, err)

	metadata1 := MetaData{Folder: "folder1", Deleted: false}
	metadata2 := MetaData{Folder: "folder2", Deleted: false}

	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid1,
		Value: metadata1,
	})
	require.NoError(t, err)

	err = store.Save(ctx, MetaDataObj{
		Key:   key,
		UID:   uid2,
		Value: metadata2,
	})
	require.NoError(t, err)

	// List latest metadata objects
	var results []MetaDataObj
	for obj, err := range store.ListLatest(ctx, key) {
		require.NoError(t, err)
		results = append(results, obj)
	}

	assert.Len(t, results, 1)
	assert.Equal(t, key, results[0].Key)
	assert.Equal(t, uid2, results[0].UID)
	assert.Equal(t, metadata2, results[0].Value)
}

func TestPrefixRangeEnd(t *testing.T) {
	prefix := "/unified/meta/apps/"
	expected := "/unified/meta/apps0" // '/' + 1 = '0'

	result := PrefixRangeEnd(prefix)
	assert.Equal(t, expected, result)
}
