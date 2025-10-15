package fakes

import (
	"context"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/plugins"
)

type FakeRegistrar struct {
	RegisterFunc func(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

func NewFakeRegistrar() *FakeRegistrar {
	return &FakeRegistrar{}
}

func (f *FakeRegistrar) Register(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if f.RegisterFunc != nil {
		return f.RegisterFunc(ctx, source, installedPlugins)
	}
	return nil
}

