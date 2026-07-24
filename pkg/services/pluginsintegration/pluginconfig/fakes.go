package pluginconfig

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/auth"
)

var _ PluginRequestConfigProvider = (*FakePluginRequestConfigProvider)(nil)

type FakePluginRequestConfigProvider struct{}

func NewFakePluginRequestConfigProvider() *FakePluginRequestConfigProvider {
	return &FakePluginRequestConfigProvider{}
}

// PluginRequestConfig returns a map of configuration that should be passed in a plugin request.
func (s *FakePluginRequestConfigProvider) PluginRequestConfig(ctx context.Context, pluginID string, externalService *auth.ExternalService) map[string]string {
	return map[string]string{}
}
