package installsyncfakes

import (
	"context"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/installsync"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var _ installsync.Syncer = &FakeSyncer{}

type FakeSyncer struct {
	SyncFunc func(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error
}

func NewFakeSyncer() *FakeSyncer {
	return &FakeSyncer{}
}

func (f *FakeSyncer) IsDisabled() bool {
	return false
}

func (f *FakeSyncer) Run(ctx context.Context) error {
	return nil
}

func (f *FakeSyncer) Sync(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error {
	if f.SyncFunc != nil {
		return f.SyncFunc(ctx, source, installedPlugins)
	}
	return nil
}
