package fakes

import (
	"context"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/installsync"
)

var _ installsync.Syncer = &FakeSyncer{}

type FakeSyncer struct {
	SyncFunc func(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

func NewFakeSyncer() *FakeSyncer {
	return &FakeSyncer{}
}

func (f *FakeSyncer) Sync(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if f.SyncFunc != nil {
		return f.SyncFunc(ctx, source, installedPlugins)
	}
	return nil
}
