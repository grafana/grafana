package mocksvcs

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type PluginErrorResolver struct {
}

// Assume no plugin with errors
func (m *PluginErrorResolver) PluginErrors(ctx context.Context) []*plugins.Error {
	return nil
}

func (m *PluginErrorResolver) PluginError(ctx context.Context, pluginID string) *plugins.Error {
	return nil
}
