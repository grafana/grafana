package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type PluginStorePanelProvider struct {
	pluginStore pluginstore.Store
}

func (p *PluginStorePanelProvider) GetPanels() []schemaversion.PanelPluginInfo {
	plugins := p.pluginStore.Plugins(context.Background(), plugins.TypePanel)

	panels := make([]schemaversion.PanelPluginInfo, len(plugins))
	for i, plugin := range plugins {
		panels[i] = schemaversion.PanelPluginInfo{
			ID: plugin.ID,
		}
	}
	return panels
}
