package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestMetadataStore(t *testing.T) *metadataStore {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	return newMetadataStore(kv)
}

func TestNewMetadataStore(t *testing.T) {
	store := setupTestMetadataStore(t)
	assert.NotNil(t, store.kv)
}

func TestMetadataStore_MetadataKey_String(t *testing.T) {
	tests := []struct {
		name       string
		metadataKey MetadataKey
		expected   string
	}{
		{
			name: "basic event key",
			metadataKey: MetadataKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			expected: "apps/resource/default",
		},
		{
			name: "empty namespace",
			metadataKey: MetadataKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			expected: "apps/resource/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.metadataKey.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMetadataStore_MetadataKey_Validate(t *testing.T) {
	tests := []struct {
		name  string
		key   MetadataKey
		error error
	}{
		{
			name: "valid key",
			key: MetadataKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			error: nil,
		},
		{
			name: "empty namespace",
			key: MetadataKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			error: errors.New("namespace '' is invalid: namespace is required"),
		},
		{
			name: "empty group",
			key: MetadataKey{
				Namespace: "default",
				Group:     "",
				Resource:  "resource",
			},
			error: errors.New("group '' is invalid: group is too short"),
		},
		{
			name: "empty resource",
			key: MetadataKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "",
			},
			error: errors.New("resource '' is invalid: resource is too short"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.key.Validate()

			if tt.error == nil {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestMetadataStore_Save_Get(t *testing.T) {
	ctx := context.Background()
	store := setupTestMetadataStore(t)

	metadata := Metadata{
		Namespace:      "default",
		Group:          "apps",
		Resource:       "resource",
		LastImportTime: time.Now().Truncate(time.Microsecond),
	}

	err := store.Save(ctx, metadata)
	require.NoError(t, err)

	metadataKey := MetadataKey{
		Namespace: "default",
		Group:     "apps",
		Resource:  "resource",
	}

	retrievedMetadata, err := store.Get(ctx, metadataKey)
	require.NoError(t, err)
	assert.Equal(t, metadata, retrievedMetadata)
}
