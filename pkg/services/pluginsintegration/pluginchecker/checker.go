package pluginchecker

import "github.com/grafana/grafana/pkg/setting"

type Preinstall interface {
	IsPreinstalled(pluginID string) bool
	IsPinned(pluginID string) bool
}

func ProvidePreinstall(
	settingsProvider setting.SettingsProvider,
) *PreinstallImpl {
	plugins := make(map[string]*setting.InstallPlugin)
	for _, p := range settingsProvider.Get().PreinstallPluginsAsync {
		plugins[p.ID] = &p
	}
	return &PreinstallImpl{
		plugins: plugins,
	}
}

type PreinstallImpl struct {
	plugins map[string]*setting.InstallPlugin
}

func (c *PreinstallImpl) IsPreinstalled(pluginID string) bool {
	_, ok := c.plugins[pluginID]
	return ok
}

func (c *PreinstallImpl) IsPinned(pluginID string) bool {
	if p, ok := c.plugins[pluginID]; ok {
		return p.Version != ""
	}
	return false
}
