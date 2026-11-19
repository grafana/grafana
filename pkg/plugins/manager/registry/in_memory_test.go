package registry

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

const (
	pluginID = "test-ds"
	v1       = "1.0.0"
	v2       = "2.0.0"
)

func TestInMemory(t *testing.T) {
	t.Run("Test mix of registry operations", func(t *testing.T) {
		i := NewInMemory()
		ctx := context.Background()

		p, exists := i.Plugin(ctx, pluginID, v1)
		require.False(t, exists)
		require.Nil(t, p)

		err := i.Remove(ctx, pluginID, v1)
		require.EqualError(t, err, fmt.Errorf("plugin %s is not registered", pluginID).Error())

		pv1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		err = i.Add(ctx, pv1)
		require.NoError(t, err)

		pv2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		err = i.Add(ctx, pv2)
		require.Errorf(t, err, fmt.Sprintf("plugin %s is already registered", pluginID))

		existingP, exists := i.Plugin(ctx, pluginID, v1)
		require.True(t, exists)
		require.Equal(t, pv1, existingP)

		p = &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID}}
		err = i.Add(ctx, p)
		require.Errorf(t, err, fmt.Sprintf("plugin %s is already registered", pluginID))

		err = i.Remove(ctx, pluginID, v1)
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
					JSONData: plugins.JSONData{
						ID: pluginID,
					},
				},
			},
		},
		{
			name: "Cannot add a plugin to the registry if it already exists",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					pluginID: {
						JSONData: plugins.JSONData{
							ID: pluginID,
						},
					},
				},
			},
			args: args{
				p: &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID: pluginID,
					},
				},
			},
			err: fmt.Errorf("plugin %s is already registered", pluginID),
		},
		{
			name: "Cannot add a plugin to the registry even if it has a different version",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					pluginID: {
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
			err: fmt.Errorf("plugin %s is already registered", pluginID),
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
		pluginID string
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
					pluginID: {
						JSONData: plugins.JSONData{
							ID: pluginID,
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
			},
			expected: &plugins.Plugin{
				JSONData: plugins.JSONData{
					ID: pluginID,
				},
			},
			exists: true,
		},
		{
			name: "Non-existing plugin",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			args: args{
				pluginID: pluginID,
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
			p, exists := i.Plugin(context.Background(), tt.args.pluginID, "")
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
			name: "Can retrieve a list of plugin",
			mocks: mocks{
				store: map[string]*plugins.Plugin{
					pluginID: {
						JSONData: plugins.JSONData{
							ID: pluginID,
						},
					},
					"test-panel": {
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
				return result[i].ID < result[j].ID
			})
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
					pluginID: {
						JSONData: plugins.JSONData{
							ID: pluginID,
						},
					},
				},
			},
			args: args{
				pluginID: pluginID,
			},
		}, {
			name: "Cannot remove a plugin from the registry if it doesn't exist",
			mocks: mocks{
				store: map[string]*plugins.Plugin{},
			},
			args: args{
				pluginID: pluginID,
			},
			err: fmt.Errorf("plugin %s is not registered", pluginID),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &InMemory{
				store: tt.mocks.store,
			}
			err := i.Remove(context.Background(), tt.args.pluginID, "")
			require.Equal(t, tt.err, err)
		})
	}
}

func TestInMemory_Notify(t *testing.T) {
	newPlugin := func(id string) *plugins.Plugin {
		return &plugins.Plugin{JSONData: plugins.JSONData{ID: id}}
	}

	t.Run("Notifies after a plugin is added or removed", func(t *testing.T) {
		i := NewInMemory()
		ch := i.Notify(t.Context())

		require.NoError(t, i.Add(t.Context(), newPlugin(pluginID)))
		require.Len(t, ch, 1)
		<-ch

		require.NoError(t, i.Remove(t.Context(), pluginID, ""))
		require.Len(t, ch, 1)
	})

	t.Run("Does not notify when nothing changes", func(t *testing.T) {
		i := NewInMemory()
		require.NoError(t, i.Add(t.Context(), newPlugin(pluginID)))
		ch := i.Notify(t.Context())

		require.Error(t, i.Add(t.Context(), newPlugin(pluginID)))
		require.Error(t, i.Remove(t.Context(), "other-ds", ""))
		require.Empty(t, ch)
	})

	t.Run("Coalesces changes that were not received", func(t *testing.T) {
		i := NewInMemory()
		ch := i.Notify(t.Context())

		require.NoError(t, i.Add(t.Context(), newPlugin("a-ds")))
		require.NoError(t, i.Add(t.Context(), newPlugin("b-ds")))
		require.Len(t, ch, 1)
	})

	t.Run("Notifies every subscriber", func(t *testing.T) {
		i := NewInMemory()
		first := i.Notify(t.Context())
		second := i.Notify(t.Context())

		require.NoError(t, i.Add(t.Context(), newPlugin(pluginID)))
		require.Len(t, first, 1)
		require.Len(t, second, 1)
	})

	t.Run("Works on a registry built without NewInMemory", func(t *testing.T) {
		i := &InMemory{store: map[string]*plugins.Plugin{}, alias: map[string]*plugins.Plugin{}}
		ch := i.Notify(t.Context())

		require.NoError(t, i.Add(t.Context(), newPlugin(pluginID)))
		require.Len(t, ch, 1)
	})

	t.Run("Closes the channel once the context is done", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			i := NewInMemory()
			ctx, cancel := context.WithCancel(t.Context())
			ch := i.Notify(ctx)
			other := i.Notify(t.Context())

			cancel()
			synctest.Wait()

			_, ok := <-ch
			require.False(t, ok)
			require.NoError(t, i.Add(t.Context(), newPlugin(pluginID)))
			require.Len(t, other, 1)
			require.Equal(t, 1, subscriberCount(i))
		})
	})

	t.Run("Closes the channel when the context is already done", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			i := NewInMemory()
			ctx, cancel := context.WithCancel(t.Context())
			cancel()

			ch := i.Notify(ctx)
			synctest.Wait()

			_, ok := <-ch
			require.False(t, ok)
			require.Zero(t, subscriberCount(i))
		})
	})

	t.Run("Is safe to use concurrently", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			i := NewInMemory()
			var wg sync.WaitGroup
			for n := range 20 {
				wg.Go(func() {
					ctx, cancel := context.WithCancel(t.Context())
					i.Notify(ctx)
					cancel()
				})
				wg.Go(func() {
					id := fmt.Sprintf("plugin-%d", n)
					assert.NoError(t, i.Add(t.Context(), newPlugin(id)))
					assert.NoError(t, i.Remove(t.Context(), id, ""))
				})
			}
			wg.Wait()
			synctest.Wait()

			require.Zero(t, subscriberCount(i))
		})
	})
}

func subscriberCount(i *InMemory) int {
	i.subMu.Lock()
	defer i.subMu.Unlock()
	return len(i.subscribers)
}

func TestAliasSupport(t *testing.T) {
	t.Run("Test alias operations", func(t *testing.T) {
		i := NewInMemory()
		ctx := context.Background()

		pluginIdNew := "plugin-new"
		pluginIdOld := "plugin-old"
		pluginIdOld2 := "plugin-old2"

		p, exists := i.Plugin(ctx, pluginIdNew, "")
		require.False(t, exists)
		require.Nil(t, p)

		pluginNew := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:       pluginIdNew,
				AliasIDs: []string{pluginIdOld, pluginIdOld2},
			},
		}
		err := i.Add(ctx, pluginNew)
		require.NoError(t, err)

		// Can lookup by the new ID
		found, exists := i.Plugin(ctx, pluginIdNew, "")
		require.True(t, exists)
		require.Equal(t, pluginNew, found)

		// Can lookup by the old ID
		found, exists = i.Plugin(ctx, pluginIdOld, "")
		require.True(t, exists)
		require.Equal(t, pluginNew, found)

		// Can lookup by the other old ID
		found, exists = i.Plugin(ctx, pluginIdOld2, "")
		require.True(t, exists)
		require.Equal(t, pluginNew, found)

		// Register the old plugin and look it up
		pluginOld := &plugins.Plugin{JSONData: plugins.JSONData{
			ID: pluginIdOld,
		}}
		require.NoError(t, i.Add(ctx, pluginOld))
		found, exists = i.Plugin(ctx, pluginIdOld, "")
		require.True(t, exists)
		require.Equal(t, pluginOld, found)
	})
}
