package process

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestProcessManager_Start(t *testing.T) {
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
				bp := fakes.NewFakeBackendPlugin(tc.managed)
				p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
					plugin.Backend = tc.backend
					plugin.SignatureError = tc.signatureError
				})

				m := &Service{}
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
		bp := fakes.NewFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.Backend = true
		})

		tickerDuration := keepPluginAliveTickerDuration
		keepPluginAliveTickerDuration = 1 * time.Millisecond
		defer func() {
			keepPluginAliveTickerDuration = tickerDuration
		}()

		m := &Service{}
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
	t.Run("Can stop a running plugin", func(t *testing.T) {
		pluginID := "test-datasource"

		bp := fakes.NewFakeBackendPlugin(true)
		p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
			plugin.ID = pluginID
			plugin.Backend = true
		})

		m := &Service{}
		err := m.Stop(context.Background(), p)
		require.NoError(t, err)

		require.True(t, p.IsDecommissioned())
		require.True(t, p.Exited())
		require.Equal(t, 1, bp.StopCount)
	})
}

func TestProcessManager_ManagedBackendPluginLifecycle(t *testing.T) {
	bp := fakes.NewFakeBackendPlugin(true)
	p := createPlugin(t, bp, func(plugin *plugins.Plugin) {
		plugin.Backend = true
	})

	m := &Service{}

	err := m.Start(context.Background(), p)
	require.NoError(t, err)
	require.Equal(t, 1, bp.StartCount)

	t.Run("When plugin process is killed, the process is restarted", func(t *testing.T) {
		var wgKill sync.WaitGroup
		wgKill.Add(1)
		go func() {
			bp.Kill() // manually kill process
			for {
				if !bp.Exited() {
					break
				}
			}
			wgKill.Done()
		}()
		wgKill.Wait()
		require.True(t, !p.Exited())
		require.Equal(t, 2, bp.StartCount)
		require.Equal(t, 0, bp.StopCount)

		t.Cleanup(func() {
			require.NoError(t, m.Stop(context.Background(), p))
		})
	})
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
