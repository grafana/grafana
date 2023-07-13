package registry

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

const (
	dsUID    = "test-ds"
	panelUID = "test-panel"
)

func TestInMemory(t *testing.T) {
	t.Run("Test mix of registry operations", func(t *testing.T) {
		i := NewInMemory()
		ctx := context.Background()

		p, exists := i.Plugin(ctx, dsUID)
		require.False(t, exists)
		require.Nil(t, p)

		err := i.Remove(ctx, dsUID)
		require.EqualError(t, err, fmt.Errorf("plugin %s is not registered", dsUID).Error())

		p = &plugins.Plugin{UID: dsUID}
		err = i.Add(ctx, p)
		require.NoError(t, err)

		existingP, exists := i.Plugin(ctx, dsUID)
		require.True(t, exists)
		require.Equal(t, p, existingP)

		err = i.Remove(ctx, dsUID)
		require.NoError(t, err)

		existingPlugins := i.Plugins(ctx)
		require.Empty(t, existingPlugins)
	})
}

func TestInMemory_Add(t *testing.T) {
	type mocks struct {
		store map[string]*plugins.Plugin
	}
	type args struct {
		p *plugins.Plugin
	}
	var tests = []struct {
		name  string
		mocks mocks
		args  args
		err   error
	}{
		{
			name: "Can add a new plugin to the registry",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			args: args{
				p: &plugins.Plugin{
					UID: dsUID,
				},
			},
		},
		{
			name: "Cannot add a plugin to the registry if it already exists",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					dsUID: {
						UID: dsUID,
					},
				},
			},
			args: args{
				p: &plugins.Plugin{
					UID: dsUID,
				},
			},
			err: fmt.Errorf("plugin %s is already registered", dsUID),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &InMemory{
				store: tt.mocks.store,
			}
			err := i.Add(context.Background(), tt.args.p)
			require.Equal(t, tt.err, err)
		})
	}
}

func TestInMemory_Plugin(t *testing.T) {
	type mocks struct {
		store map[string]*plugins.Plugin
	}
	type args struct {
		pluginUID string
	}
	tests := []struct {
		name     string
		mocks    mocks
		args     args
		expected *plugins.Plugin
		exists   bool
	}{
		{
			name: "Can retrieve a plugin",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					dsUID: {
						UID: dsUID,
					},
				},
			},
			args: args{
				pluginUID: dsUID,
			},
			expected: &plugins.Plugin{
				UID: dsUID,
			},
			exists: true,
		},
		{
			name: "Non-existing plugin",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			args: args{
				pluginUID: dsUID,
			},
			expected: nil,
			exists:   false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &InMemory{
				store: tt.mocks.store,
			}
			p, exists := i.Plugin(context.Background(), tt.args.pluginUID)
			if exists != tt.exists {
				t.Errorf("Plugin() got1 = %v, expected %v", exists, tt.exists)
			}
			require.Equal(t, tt.expected, p)
		})
	}
}

func TestInMemory_Plugins(t *testing.T) {
	type mocks struct {
		store map[string]*plugins.Plugin
	}
	tests := []struct {
		name     string
		mocks    mocks
		expected []*plugins.Plugin
	}{
		{
			name: "Can retrieve a list of plugins",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					dsUID: {
						UID: dsUID,
					},
					panelUID: {
						UID: panelUID,
					},
				},
			},
			expected: []*plugins.Plugin{
				{
					UID: dsUID,
				},
				{
					UID: panelUID,
				},
			},
		},
		{
			name: "No existing plugins",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			expected: []*plugins.Plugin{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &InMemory{
				store: tt.mocks.store,
			}
			result := i.Plugins(context.Background())

			// to ensure we can compare with expected
			sort.SliceStable(result, func(i, j int) bool {
				return result[i].UID < result[j].UID
			})
			t.Logf("%+v\n", result)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestInMemory_Remove(t *testing.T) {
	type mocks struct {
		store map[string]*plugins.Plugin
	}
	type args struct {
		pluginID string
	}
	tests := []struct {
		name  string
		mocks mocks
		args  args
		err   error
	}{
		{
			name: "Can remove a plugin",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					dsUID: {
						UID: dsUID,
					},
				},
			},
			args: args{
				pluginID: dsUID,
			},
		}, {
			name: "Cannot remove a plugin from the registry if it doesn't exist",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			args: args{
				pluginID: dsUID,
			},
			err: fmt.Errorf("plugin %s is not registered", dsUID),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &InMemory{
				store: tt.mocks.store,
			}
			err := i.Remove(context.Background(), tt.args.pluginID)
			require.Equal(t, tt.err, err)
		})
	}
}

func TestAliasSupport(t *testing.T) {
	t.Run("Test alias operations", func(t *testing.T) {
		i := NewInMemory()
		ctx := context.Background()

		pluginUidNew := "plugin-new"
		pluginUidOld := "plugin-old"

		p, exists := i.Plugin(ctx, pluginUidNew)
		require.False(t, exists)
		require.Nil(t, p)

		pluginNew := &plugins.Plugin{
			UID:   pluginUidNew,
			Alias: pluginUidOld, // TODO: move to JSONData
		}
		err := i.Add(ctx, pluginNew)
		require.NoError(t, err)

		// Can lookup by the new ID
		found, exists := i.Plugin(ctx, pluginUidNew)
		require.True(t, exists)
		require.Equal(t, pluginNew, found)

		// Can lookup by the old ID
		found, exists = i.Plugin(ctx, pluginUidNew)
		require.True(t, exists)
		require.Equal(t, pluginNew, found)

		// Register the old plugin and look it up
		pluginOld := &plugins.Plugin{UID: pluginUidOld}
		require.NoError(t, i.Add(ctx, pluginOld))
		found, exists = i.Plugin(ctx, pluginUidOld)
		require.True(t, exists)
		require.Equal(t, pluginOld, found)
	})
}
