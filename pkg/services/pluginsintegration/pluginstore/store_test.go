package pluginstore

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestStore_ProvideService(t *testing.T) {
	t.Run("Plugin sources are added in order", func(t *testing.T) {
		var addedPaths []string
		l := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				addedPaths = append(addedPaths, src.PluginURIs(ctx)...)
				return nil, nil
			},
		}

		srcs := &fakes.FakeSourceRegistry{ListFunc: func(_ context.Context) []plugins.PluginSource {
			return []plugins.PluginSource{
				&fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return "foobar"
					},
					PluginURIsFunc: func(ctx context.Context) []string {
						return []string{"path1"}
					},
				},
				&fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return plugins.ClassExternal
					},
					PluginURIsFunc: func(ctx context.Context) []string {
						return []string{"path2", "path3"}
					},
				},
			}
		}}

		_, err := ProvideService(fakes.NewFakePluginRegistry(), srcs, l)
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, addedPaths)
	})
}

func TestStore_Plugin(t *testing.T) {
	t.Run("Plugin returns all non-decommissioned plugins", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-datasource"}}
		p1.RegisterClient(&DecommissionedPlugin{})
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-panel"}}

		ps := New(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
			},
		}, &fakes.FakeLoader{})

		p, exists := ps.Plugin(context.Background(), p1.ID)
		require.False(t, exists)
		require.Equal(t, Plugin{}, p)

		p, exists = ps.Plugin(context.Background(), p2.ID)
		require.True(t, exists)
		require.Equal(t, p, ToGrafanaDTO(p2))
	})
}

func TestStore_Plugins(t *testing.T) {
	t.Run("Plugin returns all non-decommissioned plugins by type", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "a-test-datasource", Type: plugins.TypeDataSource}}
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "b-test-panel", Type: plugins.TypePanel}}
		p3 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "c-test-panel", Type: plugins.TypePanel}}
		p4 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "d-test-app", Type: plugins.TypeApp}}
		p5 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "e-test-panel", Type: plugins.TypePanel}}
		p5.RegisterClient(&DecommissionedPlugin{})

		ps := New(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
				p3.ID: p3,
				p4.ID: p4,
				p5.ID: p5,
			},
		}, &fakes.FakeLoader{})

		ToGrafanaDTO(p1)
		pss := ps.Plugins(context.Background())
		require.Equal(t, pss, []Plugin{
			ToGrafanaDTO(p1), ToGrafanaDTO(p2),
			ToGrafanaDTO(p3), ToGrafanaDTO(p4),
		})

		pss = ps.Plugins(context.Background(), plugins.TypeApp)
		require.Equal(t, pss, []Plugin{ToGrafanaDTO(p4)})

		pss = ps.Plugins(context.Background(), plugins.TypePanel)
		require.Equal(t, pss, []Plugin{ToGrafanaDTO(p2), ToGrafanaDTO(p3)})

		pss = ps.Plugins(context.Background(), plugins.TypeDataSource)
		require.Equal(t, pss, []Plugin{ToGrafanaDTO(p1)})

		pss = ps.Plugins(context.Background(), plugins.TypeDataSource, plugins.TypeApp, plugins.TypePanel)
		require.Equal(t, pss, []Plugin{
			ToGrafanaDTO(p1), ToGrafanaDTO(p2),
			ToGrafanaDTO(p3), ToGrafanaDTO(p4),
		})
	})
}

func TestStore_Routes(t *testing.T) {
	t.Run("Routes returns all static routes for non-decommissioned plugins", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "a-test-renderer", Type: plugins.TypeRenderer}, FS: fakes.NewFakePluginFS("/some/dir")}
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "b-test-panel", Type: plugins.TypePanel}, FS: fakes.NewFakePluginFS("/grafana/")}
		p3 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "c-test-secrets", Type: plugins.TypeSecretsManager}, FS: fakes.NewFakePluginFS("./secrets"), Class: plugins.ClassCore}
		p4 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "d-test-datasource", Type: plugins.TypeDataSource}, FS: fakes.NewFakePluginFS("../test")}
		p5 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "e-test-app", Type: plugins.TypeApp}, FS: fakes.NewFakePluginFS("any/path")}
		p6 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "f-test-app", Type: plugins.TypeApp}}
		p6.RegisterClient(&DecommissionedPlugin{})

		ps := New(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
				p3.ID: p3,
				p4.ID: p4,
				p5.ID: p5,
				p6.ID: p6,
			},
		}, &fakes.FakeLoader{})

		sr := func(p *plugins.Plugin) *plugins.StaticRoute {
			return &plugins.StaticRoute{PluginID: p.ID, Directory: p.FS.Base()}
		}

		rs := ps.Routes(context.Background())
		require.Equal(t, []*plugins.StaticRoute{sr(p1), sr(p2), sr(p4), sr(p5)}, rs)
	})
}

func TestStore_SecretsManager(t *testing.T) {
	t.Run("Renderer returns a single (non-decommissioned) secrets manager plugin", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-renderer", Type: plugins.TypeRenderer}}
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-panel", Type: plugins.TypePanel}}
		p3 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-secrets", Type: plugins.TypeSecretsManager}}
		p4 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-datasource", Type: plugins.TypeDataSource}}

		ps := New(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
				p3.ID: p3,
				p4.ID: p4,
			},
		}, &fakes.FakeLoader{})

		r := ps.SecretsManager(context.Background())
		require.Equal(t, p3, r)
	})
}

func TestProcessManager_shutdown(t *testing.T) {
	p := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-datasource", Type: plugins.TypeDataSource}} // Backend: true
	backend := &fakes.FakeBackendPlugin{}
	p.RegisterClient(backend)
	p.SetLogger(log.NewTestLogger())

	unloaded := false
	ps := New(&fakes.FakePluginRegistry{
		Store: map[string]*plugins.Plugin{
			p.ID: p,
		},
	}, &fakes.FakeLoader{
		UnloadFunc: func(_ context.Context, plugin *plugins.Plugin) (*plugins.Plugin, error) {
			require.Equal(t, p, plugin)
			unloaded = true
			return nil, nil
		},
	})

	pCtx := context.Background()
	cCtx, cancel := context.WithCancel(pCtx)
	var wgRun sync.WaitGroup
	wgRun.Add(1)
	var runErr error
	go func() {
		runErr = ps.Run(cCtx)
		wgRun.Done()
	}()

	t.Run("When context is cancelled the plugin is stopped", func(t *testing.T) {
		cancel()
		wgRun.Wait()
		require.ErrorIs(t, runErr, context.Canceled)
		require.True(t, unloaded)
	})
}

func TestStore_availablePlugins(t *testing.T) {
	t.Run("Decommissioned plugins are excluded from availablePlugins", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-datasource"}}
		p1.RegisterClient(&DecommissionedPlugin{})
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-app"}}

		ps := New(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
			},
		}, &fakes.FakeLoader{})

		aps := ps.availablePlugins(context.Background())
		require.Len(t, aps, 1)
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
