package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

func TestStore_availablePlugins(t *testing.T) {
	t.Run("Decommissioned plugins are excluded from availablePlugins", func(t *testing.T) {
		p1 := &plugins.Plugin{
			Class: plugins.External,
			JSONData: plugins.JSONData{
				ID:   "org1-test-datasource",
				Type: plugins.DataSource,
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
		}
		p1.RegisterClient(&DecommissionedPlugin{})
		err := p1.Decommission()
		require.NoError(t, err)

		p2 := &plugins.Plugin{
			Class: plugins.External,
			JSONData: plugins.JSONData{
				ID:   "org2-test-datasource",
				Type: plugins.DataSource,
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
		}

		ps := ProvideService(
			newFakePluginRegistry(map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
			}),
		)

		aps := ps.availablePlugins(context.Background())
		require.Equal(t, 1, len(aps))
		require.Equal(t, p2, aps[0])
	})
}

type DecommissionedPlugin struct {
	backendplugin.Plugin
}

func (p *DecommissionedPlugin) Decommission() error {
	return nil
}

func (p *DecommissionedPlugin) IsDecommissioned() bool {
	return true
}

type fakePluginRegistry struct {
	store map[string]*plugins.Plugin
}

func newFakePluginRegistry(m map[string]*plugins.Plugin) *fakePluginRegistry {
	return &fakePluginRegistry{
		store: m,
	}
}

func (f *fakePluginRegistry) Plugin(_ context.Context, id string) (*plugins.Plugin, bool) {
	p, exists := f.store[id]
	return p, exists
}

func (f *fakePluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin

	for _, p := range f.store {
		res = append(res, p)
	}

	return res
}

func (f *fakePluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.store[p.ID] = p
	return nil
}

func (f *fakePluginRegistry) Remove(_ context.Context, id string) error {
	delete(f.store, id)
	return nil
}
