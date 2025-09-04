package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type PluginStorePanelProvider struct {
	pluginStore  pluginstore.Store
	buildVersion string
}

func (p *PluginStorePanelProvider) GetPanels() []schemaversion.PanelPluginInfo {
	panelPlugins := p.pluginStore.Plugins(context.Background(), plugins.TypePanel)

	panels := make([]schemaversion.PanelPluginInfo, len(panelPlugins))
	for i, plugin := range panelPlugins {
		version := plugin.Info.Version
		if version == "" {
			version = p.buildVersion
		}
		panels[i] = schemaversion.PanelPluginInfo{
			ID:      plugin.ID,
			Version: version,
		}
	}
	return panels
}

func (p *PluginStorePanelProvider) GetPanelPlugin(id string) schemaversion.PanelPluginInfo {
	for _, plugin := range p.GetPanels() {
		if plugin.ID == id {
			return plugin
		}
	}

	return schemaversion.PanelPluginInfo{}
}
