package pluginconfig

import (
	"context"
)

var _ PluginRequestConfigProvider = (*FakePluginRequestConfigProvider)(nil)

type FakePluginRequestConfigProvider struct{}

func NewFakePluginRequestConfigProvider() *FakePluginRequestConfigProvider {
	return &FakePluginRequestConfigProvider{}
}

// PluginRequestConfig returns a map of configuration that should be passed in a plugin request.
func (s *FakePluginRequestConfigProvider) PluginRequestConfig(ctx context.Context, plugin PluginInfo) map[string]string {
	return map[string]string{}
}
