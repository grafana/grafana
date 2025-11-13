package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestSettingStore(t *testing.T) *settingStore {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	return newSettingStore(kv)
}

func TestNewSettingStore(t *testing.T) {
	store := setupTestSettingStore(t)
	assert.NotNil(t, store.kv)
}

func TestSettingStore_SettingKey_String(t *testing.T) {
	tests := []struct {
		name       string
		settingKey SettingKey
		expected   string
	}{
		{
			name: "basic event key",
			settingKey: SettingKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			expected: "apps/resource/default",
		},
		{
			name: "empty namespace",
			settingKey: SettingKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			expected: "apps/resource/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.settingKey.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSettingStore_SettingKey_Validate(t *testing.T) {
	tests := []struct {
		name  string
		key   SettingKey
		error error
	}{
		{
			name: "valid key",
			key: SettingKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resource",
			},
			error: nil,
		},
		{
			name: "empty namespace",
			key: SettingKey{
				Namespace: "",
				Group:     "apps",
				Resource:  "resource",
			},
			error: errors.New("namespace '' is invalid: namespace is required"),
		},
		{
			name: "empty group",
			key: SettingKey{
				Namespace: "default",
				Group:     "",
				Resource:  "resource",
			},
			error: errors.New("group '' is invalid: group is too short"),
		},
		{
			name: "empty resource",
			key: SettingKey{
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

func TestSettingStore_Save_Get(t *testing.T) {
	ctx := context.Background()
	store := setupTestSettingStore(t)

	setting := Setting{
		Namespace:      "default",
		Group:          "apps",
		Resource:       "resource",
		LastImportTime: time.Now().Truncate(time.Microsecond),
	}

	err := store.Save(ctx, setting)
	require.NoError(t, err)

	settingKey := SettingKey{
		Namespace: "default",
		Group:     "apps",
		Resource:  "resource",
	}

	retrievedSetting, err := store.Get(ctx, settingKey)
	require.NoError(t, err)
	assert.Equal(t, setting, retrievedSetting)
}
