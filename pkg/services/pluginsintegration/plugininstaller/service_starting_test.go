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
	"gopkg.in/ini.v1"
)

type delayedPluginStore struct {
	delay   time.Duration
	started chan struct{}
}

func (s delayedPluginStore) Plugin(ctx context.Context, _ string) (pluginstore.Plugin, bool) {
	if s.started != nil {
		close(s.started)
	}

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

func newStartingService(store pluginstore.Store, installer plugins.Installer, cfg *setting.Cfg) *Service {
	return &Service{
		cfg:             cfg,
		log:             log.New(ServiceName),
		pluginInstaller: installer,
		pluginStore:     store,
	}
}

func TestService_startingHonorsParentCancellation(t *testing.T) {
	installed := false
	installer := &pluginfakes.FakePluginInstaller{
		AddFunc: func(ctx context.Context, _ string, _ string, _ plugins.AddOpts) error {
			installed = true
			return nil
		},
	}

	lookupStarted := make(chan struct{})
	s := newStartingService(delayedPluginStore{delay: time.Second, started: lookupStarted}, installer, &setting.Cfg{
		PreinstallPluginsSync: []setting.InstallPlugin{{ID: "myplugin"}},
	})

	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan error, 1)
	go func() {
		started <- s.starting(ctx)
	}()

	<-lookupStarted
	cancel()

	require.ErrorIs(t, <-started, context.Canceled)
	require.False(t, installed)
}

func TestService_startingUsesConfiguredTimeout(t *testing.T) {
	installed := false
	installer := &pluginfakes.FakePluginInstaller{
		AddFunc: func(ctx context.Context, _ string, _ string, _ plugins.AddOpts) error {
			installed = true
			return nil
		},
	}

	raw, err := ini.Load([]byte("[plugins]\npreinstall_sync_timeout = 5ms\n"))
	require.NoError(t, err)

	s := newStartingService(delayedPluginStore{delay: 50 * time.Millisecond}, installer, &setting.Cfg{
		Raw:                   raw,
		PreinstallPluginsSync: []setting.InstallPlugin{{ID: "myplugin"}},
	})

	require.ErrorIs(t, s.starting(context.Background()), context.DeadlineExceeded)
	require.False(t, installed)
}
