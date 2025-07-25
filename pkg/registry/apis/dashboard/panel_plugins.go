package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginStorePanelProvider struct {
	pluginStore pluginstore.Store
	setting     *setting.Cfg
}

func (p *PluginStorePanelProvider) GetPanels() []schemaversion.PanelPluginInfo {
	plugins := p.pluginStore.Plugins(context.Background(), plugins.TypePanel)

	panels := make([]schemaversion.PanelPluginInfo, len(plugins))
	for i, plugin := range plugins {
		version := plugin.Info.Version
		if version == "" {
			version = p.setting.BuildVersion
		}
		panels[i] = schemaversion.PanelPluginInfo{
			ID:      plugin.ID,
			Version: version,
		}
	}
	return panels
}

func (p *PluginStorePanelProvider) GetPanelPlugin(id string) schemaversion.PanelPluginInfo {
	plugins := p.GetPanels()

	panelPlugin := schemaversion.PanelPluginInfo{}

	for _, plugin := range plugins {
		if plugin.ID == id {
			panelPlugin = schemaversion.PanelPluginInfo{
				ID:      plugin.ID,
				Version: plugin.Version,
			}
		}
	}

	if panelPlugin.ID == "" {
		return schemaversion.PanelPluginInfo{}
	}

	return panelPlugin
}
