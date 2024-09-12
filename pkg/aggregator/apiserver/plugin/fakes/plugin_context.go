package fakes

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type FakePluginContextProvider struct {
	PluginContext backend.PluginContext
	Err           error
}

func (f FakePluginContextProvider) GetPluginContext(ctx context.Context, pluginID, dsUID string) (backend.PluginContext, error) {
	return f.PluginContext, f.Err
}
