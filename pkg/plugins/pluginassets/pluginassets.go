package pluginassets

import (
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
)

var _ Provider = (*LocalProvider)(nil)

type LocalProvider struct{}

func ProvideService() *LocalProvider {
	return &LocalProvider{}
}

func (s *LocalProvider) Module(plugin PluginInfo) (string, error) {
	if plugin.Class == plugins.ClassCore && filepath.Base(plugin.FS.Base()) != "dist" {
		return path.Join("core:plugin", filepath.Base(plugin.FS.Base())), nil
	}

	return s.AssetPath(plugin, "module.js")
}

func (s *LocalProvider) AssetPath(plugin PluginInfo, assetPath ...string) (string, error) {
	return path.Join("public/plugins", plugin.JsonData.ID, path.Join(assetPath...)), nil
}
