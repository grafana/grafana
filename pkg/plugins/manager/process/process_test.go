package process

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

func TestProcessManager_Start(t *testing.T) {
	t.Run("Plugin not found in registry", func(t *testing.T) {
		m := NewManager(fakes.NewFakePluginRegistry())
		err := m.Start(context.Background(), "non-existing-datasource")
		require.ErrorIs(t, err, backendplugin.ErrPluginNotRegistered)
	})

	t.Run("Plugin state determines process start", func(t *testing.T) {
		tcs := []struct {
			name               string
			managed            bool
			backend            bool
			signatureError     *plugins.SignatureError
			expectedStartCount int
		}{
			{
				name:               "Unmanaged backend plugin will not be started",
				managed:            false,
				backend:            true,
				expectedStartCount: 0,
			},
			{
				name:               "Managed non-backend plugin will not be started",
				managed:            false,
				backend:            true,
				expectedStartCount: 0,
			},
			{
				name:    "Managed backend plugin with signature error will not be started",
				managed: true,
				backend: true,
				signatureError: &plugins.SignatureError{
					SignatureStatus: plugins.SignatureStatusUnsigned,
				},
				expectedStartCount: 0,
			},
			{
				name:               "Managed backend plugin with no signature errors will be started",
				managed:            true,
				backend:            true,
				expectedStartCount: 1,
			},
		}
		for _, tc := range tcs {
			t.Run(tc.name, func(t *testing.T) {
				bp := newFakeBackendPlugin(tc.managed)
				p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
					plugin.Backend = tc.backend
					plugin.SignatureError = tc.signatureError
				})

				m := NewManager(&fakes.FakePluginRegistry{
					Store: map[string]*plugins.Plugin{
						p.ID: p,
					}},
				)

				err := m.Start(context.Background(), p.ID)
				require.NoError(t, err)
				require.Equal(t, tc.expectedStartCount, bp.startCount)

				if tc.expectedStartCount > 0 {
					require.True(t, !p.Exited())
				} else {
					require.True(t, p.Exited())
				}
			})
		}
	})
}

func TestProcessManager_Stop(t *testing.T) {
	t.Run("Plugin not found in registry", func(t *testing.T) {
		m := NewManager(fakes.NewFakePluginRegistry())
		err := m.Stop(context.Background(), "non-existing-datasource")
		require.ErrorIs(t, err, backendplugin.ErrPluginNotRegistered)
	})

	t.Run("Can stop a running plugin", func(t *testing.T) {
		pluginID := "test-datasource"

		bp := newFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.ID = pluginID
			plugin.Backend = true
		})

		m := NewManager(&fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				pluginID: p,
			}},
		)
		err := m.Stop(context.Background(), pluginID)
		require.NoError(t, err)

		require.True(t, p.IsDecommissioned())
		require.True(t, bp.decommissioned)
		require.True(t, p.Exited())
		require.Equal(t, 1, bp.stopCount)
	})
}

func TestProcessManager_ManagedBackendPluginLifecycle(t *testing.T) {
	bp := newFakeBackendPlugin(true)
	p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
		plugin.Backend = true
	})

	m := NewManager(&fakes.FakePluginRegistry{
		Store: map[string]*plugins.Plugin{
			p.ID: p,
		}},
	)

	err := m.Start(context.Background(), p.ID)
	require.NoError(t, err)
	require.Equal(t, 1, bp.startCount)

	t.Run("When plugin process is killed, the process is restarted", func(t *testing.T) {
		pCtx := context.Background()
		cCtx, cancel := context.WithCancel(pCtx)
		var wgRun sync.WaitGroup
		wgRun.Add(1)
		var runErr error
		go func() {
			runErr = m.Run(cCtx)
			wgRun.Done()
		}()

		var wgKill sync.WaitGroup
		wgKill.Add(1)
		go func() {
			bp.kill() // manually kill process
			for {
				if !bp.Exited() {
					break
				}
			}
			wgKill.Done()
		}()
		wgKill.Wait()
		require.True(t, !p.Exited())
		require.Equal(t, 2, bp.startCount)
		require.Equal(t, 0, bp.stopCount)

		t.Run("When context is cancelled the plugin is stopped", func(t *testing.T) {
			cancel()
			wgRun.Wait()
			require.ErrorIs(t, runErr, context.Canceled)
			require.True(t, p.Exited())
			require.Equal(t, 2, bp.startCount)
			require.Equal(t, 1, bp.stopCount)
		})
	})
}

type fakeBackendPlugin struct {
	managed bool

	startCount     int
	stopCount      int
	decommissioned bool
	running        bool

	mutex sync.RWMutex
	backendplugin.Plugin
}

func newFakeBackendPlugin(managed bool) *fakeBackendPlugin {
	return &fakeBackendPlugin{
		managed: managed,
	}
}

func (p *fakeBackendPlugin) Start(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.running = true
	p.startCount++
	return nil
}

func (p *fakeBackendPlugin) Stop(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.running = false
	p.stopCount++
	return nil
}

func (p *fakeBackendPlugin) Decommission() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.decommissioned = true
	return nil
}

func (p *fakeBackendPlugin) IsDecommissioned() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.decommissioned
}

func (p *fakeBackendPlugin) IsManaged() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.managed
}

func (p *fakeBackendPlugin) Exited() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return !p.running
}

func (p *fakeBackendPlugin) kill() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.running = false
}

func createPlugin(t *testing.T, bp backendplugin.Plugin, cbs ...func(p *plugins.Plugin)) *plugins.Plugin {
	t.Helper()

	p := &plugins.Plugin{
		Class: plugins.ClassExternal,
		JSONData: plugins.JSONData{
			ID: "test-datasource",
		},
	}

	p.SetLogger(log.NewTestLogger())
	p.RegisterClient(bp)

	for _, cb := range cbs {
		cb(p)
	}

	return p
}
