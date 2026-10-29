package process

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
)

func TestProcessManager_Start(t *testing.T) {
	t.Parallel()

	t.Run("Plugin state determines process start", func(t *testing.T) {
		t.Parallel()

		tcs := []struct {
			name               string
			managed            bool
			backend            bool
			Error              *plugins.Error
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
				Error: &plugins.Error{
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
			// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
			// otherwise it would be like a moving pointer while tests run in parallel
			tc := tc

			t.Run(tc.name, func(t *testing.T) {
				t.Parallel()

				bp := pluginfakes.NewFakeBackendPlugin(tc.managed)
				p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
					plugin.Backend = tc.backend
					plugin.Error = tc.Error
				})

				m := ProvideService()
				err := m.Start(context.Background(), p)
				require.NoError(t, err)
				require.Equal(t, tc.expectedStartCount, bp.StartCount)

				if tc.expectedStartCount > 0 {
					require.True(t, !p.Exited())
				} else {
					require.True(t, p.Exited())
				}
			})
		}
	})

	t.Run("Won't stop the plugin if the context is cancelled", func(t *testing.T) {
		t.Parallel()

		bp := pluginfakes.NewFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.Backend = true
		})

		m := ProvideService()
		m.keepPluginAliveTickerDuration = 1
		ctx := context.Background()
		ctx, cancel := context.WithCancel(ctx)
		err := m.Start(ctx, p)
		require.NoError(t, err)
		require.Equal(t, 1, bp.StartCount)
		cancel()

		<-bp.ExitedCheckDoneOrStopped
		require.False(t, p.Exited())
		require.Equal(t, 0, bp.StopCount)
	})
}

func TestProcessManager_Stop(t *testing.T) {
	t.Parallel()

	t.Run("Can stop a running plugin", func(t *testing.T) {
		t.Parallel()

		pluginID := "test-datasource"

		bp := pluginfakes.NewFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.ID = pluginID
			plugin.Backend = true
		})

		m := ProvideService()
		err := m.Stop(context.Background(), p)
		require.NoError(t, err)

		require.True(t, p.IsDecommissioned())
		require.True(t, p.Exited())
		require.Equal(t, 1, bp.StopCount)
	})
}

func TestProcessManager_ManagedBackendPluginLifecycle(t *testing.T) {
	t.Parallel()

	t.Run("When plugin process is killed, the process is restarted", func(t *testing.T) {
		t.Parallel()
		bp := pluginfakes.NewFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.Backend = true
		})

		m := ProvideService()

		err := m.Start(context.Background(), p)
		require.NoError(t, err)
		require.Equal(t, 1, bp.StartCount)

		var wgKill sync.WaitGroup
		wgKill.Go(func() {
			bp.Kill() // manually kill process
			for bp.Exited() {

			}
		})
		wgKill.Wait()
		require.True(t, !p.Exited())
		require.Equal(t, 2, bp.StartCount)
		require.Equal(t, 0, bp.StopCount)

		t.Cleanup(func() {
			require.NoError(t, m.Stop(context.Background(), p))
		})
	})
}

func TestProcessManager_KeepPluginAliveBacksOff(t *testing.T) {
	bp := &failingBackendPlugin{FakeBackendPlugin: pluginfakes.NewFakeBackendPlugin(true)}
	p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
		plugin.Backend = true
	})
	m := ProvideService()
	m.keepPluginAliveTickerDuration = time.Millisecond

	done := make(chan struct{})
	go func() {
		_ = m.keepPluginAlive(p)
		close(done)
	}()
	time.Sleep(300 * time.Millisecond)
	require.NoError(t, p.Decommission())
	<-done

	// One attempt per tick would be about 300; doubling waits allow about 9.
	starts := bp.starts.Load()
	require.Greater(t, starts, int32(1), "a failed plugin is still retried")
	require.Less(t, starts, int32(30), "a plugin whose start keeps failing is retried with backoff")
}

// failingBackendPlugin always fails to start and has no running process.
type failingBackendPlugin struct {
	*pluginfakes.FakeBackendPlugin
	starts atomic.Int32
}

func (p *failingBackendPlugin) Start(context.Context) error {
	p.starts.Add(1)
	return errors.New("plugin protocol version not supported")
}

func (p *failingBackendPlugin) Exited() bool { return true }

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
