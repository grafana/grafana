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
	pluginID = "test-ds"
	v1       = "1.0.0"
	v2       = "2.0.0"
)

func TestMultiPluginVersion(t *testing.T) {
	t.Run("Test mix of registry operations", func(t *testing.T) {
		i := NewMultiPluginVersion()
		ctx := context.Background()

		p, exists := i.Plugin(ctx, pluginID, v1)
		require.False(t, exists)
		require.Nil(t, p)

		err := i.Remove(ctx, pluginID, v1)
		require.EqualError(t, err, fmt.Errorf("plugin %s v%s is not registered", pluginID, v1).Error())

		pv1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		err = i.Add(ctx, pv1)
		require.NoError(t, err)

		pv2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		err = i.Add(ctx, pv2)
		require.NoError(t, err)

		existingP, exists := i.Plugin(ctx, pluginID, v1)
		require.True(t, exists)
		require.Equal(t, pv1, existingP)

		existingP, exists = i.Plugin(ctx, pluginID, v2)
		require.True(t, exists)
		require.Equal(t, pv2, existingP)

		err = i.Remove(ctx, pluginID, v1)
		require.NoError(t, err)

		existingP, exists = i.Plugin(ctx, pluginID, v1)
		require.False(t, exists)
		require.Nil(t, existingP)

		existingP, exists = i.Plugin(ctx, pluginID, v2)
		require.True(t, exists)
		require.Equal(t, pv2, existingP)

		err = i.Remove(ctx, pluginID, v2)
		require.NoError(t, err)

		existingPlugins := i.Plugins(ctx)
		require.Empty(t, existingPlugins)
	})
}

func TestMultiPluginVersion_Add(t *testing.T) {
	type mocks struct {
		store []*plugins.Plugin
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
				store: []*plugins.Plugin{},
			},
			args: args{
				p: &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID:   pluginID,
						Info: plugins.Info{Version: v1},
					},
				},
			},
		},
		{
			name: "Cannot add a plugin to the registry if it already exists",
			mocks: mocks{
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
				},
			},
			args: args{
				p: &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID:   pluginID,
						Info: plugins.Info{Version: v1},
					},
				},
			},
			err: fmt.Errorf("plugin %s v%s is already registered", pluginID, v1),
		},
		{
			name: "Can add a plugin to the registry if it has a different version",
			mocks: mocks{
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
				},
			},
			args: args{
				p: &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID:   pluginID,
						Info: plugins.Info{Version: v2},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := NewMultiPluginVersion(tt.mocks.store...)
			err := i.Add(context.Background(), tt.args.p)
			require.Equal(t, tt.err, err)
		})
	}
}

func TestMultiPluginVersion_Plugin(t *testing.T) {
	type mocks struct {
		store []*plugins.Plugin
	}
	type args struct {
		pluginID string
		version  string
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
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
				version:  v1,
			},
			expected: &plugins.Plugin{
				JSONData: plugins.JSONData{
					ID:   pluginID,
					Info: plugins.Info{Version: v1},
				},
			},
			exists: true,
		},
		{
			name: "Non-existing plugin version",
			mocks: mocks{
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
				version:  v2,
			},
			expected: nil,
			exists:   false,
		},
		{
			name: "Non-existing plugin",
			mocks: mocks{
				store: []*plugins.Plugin{},
			},
			args: args{
				pluginID: pluginID,
				version:  v1,
			},
			expected: nil,
			exists:   false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := NewMultiPluginVersion(tt.mocks.store...)
			p, exists := i.Plugin(context.Background(), tt.args.pluginID, tt.args.version)
			if exists != tt.exists {
				t.Errorf("Plugin() got = %v, expected %v", exists, tt.exists)
			}
			require.Equal(t, tt.expected, p)
		})
	}
}

func TestMultiPluginVersion_Plugins(t *testing.T) {
	type mocks struct {
		store []*plugins.Plugin
	}
	tests := []struct {
		name     string
		mocks    mocks
		expected []*plugins.Plugin
	}{
		{
			name: "Can retrieve a list of plugin",
			mocks: mocks{
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID: pluginID,
						},
					},
					{
						JSONData: plugins.JSONData{
							ID: "test-panel",
						},
					},
				},
			},
			expected: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID: pluginID,
					},
				},
				{
					JSONData: plugins.JSONData{
						ID: "test-panel",
					},
				},
			},
		},
		{
			name: "No existing plugins",
			mocks: mocks{
				store: []*plugins.Plugin{},
			},
			expected: []*plugins.Plugin{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := NewMultiPluginVersion(tt.mocks.store...)
			result := i.Plugins(context.Background())

			// to ensure we can compare with expected
			sort.SliceStable(result, func(i, j int) bool {
				return result[i].ID < result[j].ID
			})
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestMultiPluginVersion_Remove(t *testing.T) {
	type mocks struct {
		store []*plugins.Plugin
	}
	type args struct {
		pluginID string
		version  string
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
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
				version:  v1,
			},
		},
		{
			name: "Can remove a single version plugin",
			mocks: mocks{
				store: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v1},
						},
					},
					{
						JSONData: plugins.JSONData{
							ID:   pluginID,
							Info: plugins.Info{Version: v2},
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
				version:  v2,
			},
		},
		{
			name: "Cannot remove a plugin from the registry if it doesn't exist",
			mocks: mocks{
				store: []*plugins.Plugin{},
			},
			args: args{
				pluginID: pluginID,
				version:  v2,
			},
			err: fmt.Errorf("plugin %s v%s is not registered", pluginID, v2),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := NewMultiPluginVersion(tt.mocks.store...)
			err := i.Remove(context.Background(), tt.args.pluginID, tt.args.version)
			require.Equal(t, tt.err, err)
		})
	}
}
