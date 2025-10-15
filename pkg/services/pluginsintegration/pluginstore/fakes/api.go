package fakes

import (
	"context"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/plugins"
)

type FakeInstallsAPIRegistrar struct {
	RegisterFunc func(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

func NewFakeInstallsAPIRegistrar() *FakeInstallsAPIRegistrar {
	return &FakeInstallsAPIRegistrar{}
}

func (f *FakeInstallsAPIRegistrar) Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if f.RegisterFunc != nil {
		return f.RegisterFunc(ctx, source, installedPlugins)
	}
	return nil
}
