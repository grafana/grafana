package plugininstaller

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

type delayedPluginStore struct {
	delay time.Duration
}

func (s delayedPluginStore) Plugin(ctx context.Context, _ string) (pluginstore.Plugin, bool) {
	select {
	case <-time.After(s.delay):
		return pluginstore.Plugin{}, false
	case <-ctx.Done():
		return pluginstore.Plugin{}, false
	}
}

func (s delayedPluginStore) Plugins(context.Context, ...plugins.Type) []pluginstore.Plugin {
	return nil
}

func TestService_startingDoesNotUseParentCancellation(t *testing.T) {
	installed := false
	installer := &pluginfakes.FakePluginInstaller{
		AddFunc: func(ctx context.Context, _ string, _ string, _ plugins.AddOpts) error {
			select {
			case <-time.After(10 * time.Millisecond):
				installed = true
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		},
	}

	s := &Service{
		cfg: &setting.Cfg{
			PreinstallPluginsSync: []setting.InstallPlugin{{ID: "myplugin"}},
		},
		log:             log.New(ServiceName),
		pluginInstaller: installer,
		pluginStore:     delayedPluginStore{delay: 10 * time.Millisecond},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	require.NoError(t, s.starting(ctx))
	require.True(t, installed)
}
