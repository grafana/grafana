package resource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestInternalStore(t *testing.T) *internalStore {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	return newInternalStore(kv)
}

func TestNewInternalStore(t *testing.T) {
	store := setupTestInternalStore(t)
	assert.NotNil(t, store.kv)
}

func TestInternalStore_InternalKey_String(t *testing.T) {
	tests := []struct {
		name        string
		internalKey InternalKey
		expected    string
	}{
		{
			name: "basic internal key",
			internalKey: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "lastimporttime",
			},
			expected: "lastimporttime/apps/resource/default",
		},
		{
			name: "subsection should be lowercased",
			internalKey: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "LastImportTime",
			},
			expected: "lastimporttime/apps/resource/default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.internalKey.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestInternalStore_InternalKey_Validate(t *testing.T) {
	tests := []struct {
		name  string
		key   InternalKey
		error error
	}{
		{
			name: "valid key",
			key: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "lastimporttime",
			},
			error: nil,
		},
		{
			name: "valid key no value",
			key: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "lastimporttime",
			},
			error: nil,
		},
		{
			name: "empty namespace",
			key: InternalKey{
				Namespace:  "",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "lastimporttime",
			},
			error: errors.New("namespace '' is invalid: namespace is required"),
		},
		{
			name: "empty group",
			key: InternalKey{
				Namespace:  "default",
				Group:      "",
				Resource:   "resource",
				Subsection: "lastimporttime",
			},
			error: errors.New("group '' is invalid: group is too short"),
		},
		{
			name: "empty resource",
			key: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "",
				Subsection: "lastimporttime",
			},
			error: errors.New("resource '' is invalid: resource is too short"),
		},
		{
			name: "empty subsection",
			key: InternalKey{
				Namespace:  "default",
				Group:      "apps",
				Resource:   "resource",
				Subsection: "",
			},
			error: errors.New("Subsection '' is invalid: Subsection is required"),
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

func TestInternalStore(t *testing.T) {
	t.Run("Save and Get", func(t *testing.T) {
		ctx := context.Background()
		store := setupTestInternalStore(t)
		key := InternalKey{
			Namespace:  "default",
			Group:      "apps",
			Resource:   "resource",
			Subsection: "lastimporttime",
		}

		err := store.Save(ctx, key, "1")
		require.NoError(t, err)

		value, err := store.Get(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, "1", value)
	})

	t.Run("GetSubsection and BatchGet", func(t *testing.T) {
		ctx := context.Background()
		store := setupTestInternalStore(t)
		things := []struct {
			key   InternalKey
			value string
		}{
			{
				key: InternalKey{
					Namespace:  "stacks-1",
					Group:      "apps",
					Resource:   "resource",
					Subsection: "lastimporttime",
				},
				value:      "foo1",
			},
			{
				key: InternalKey{
					Namespace:  "stacks-2",
					Group:      "apps",
					Resource:   "resource",
					Subsection: "lastimporttime",
				},
				value:      "foo2",
			},
			{
				key: InternalKey{
					Namespace:  "stacks-3",
					Group:      "apps",
					Resource:   "resource",
					Subsection: "lastimporttime",
				},
				value:      "foo3",
			},
			{
				key: InternalKey{
					Namespace:  "stacks-4",
					Group:      "apps",
					Resource:   "resource",
					Subsection: "lastimporttime",
				},
				value:      "foo4",
			},
			{
				key: InternalKey{
					Namespace:  "stacks-5",
					Group:      "apps",
					Resource:   "resource",
					Subsection: "lastimporttime",
				},
				value:      "foo5",
			},
		}

		for _, thing := range things {
			err := store.Save(ctx, thing.key, thing.value)
			require.NoError(t, err)
		}

		var i int
		for thing, err := range store.GetSubsection(ctx, "lastimporttime") {
			require.NoError(t, err)
			require.Equal(t, things[i].key, thing)
			data, err := store.Get(ctx, things[i].key)
			require.NoError(t, err)
			require.Equal(t, data.Value, things[i].value)
			i++
		}

		keys := make([]InternalKey, len(things))
		for _, thing := range things {
			keys = append(keys, thing.key)
		}
		var j int
		for data, err := range store.BatchGet(ctx, keys) {
			require.NoError(t, err)
			require.Equal(t, things[j].key.Namespace, data.Namespace)
			require.Equal(t, things[j].key.Group, data.Group)
			require.Equal(t, things[j].key.Resource, data.Resource)
			require.Equal(t, things[j].key.Subsection, data.Subsection)
			require.Equal(t, things[j].value, data.Value)
		}
	})
}
