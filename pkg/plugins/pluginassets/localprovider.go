package pluginassets

import (
	"net/url"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
)

var _ Provider = (*LocalProvider)(nil)

type LocalProvider struct{}

func NewLocalProvider() *LocalProvider {
	return &LocalProvider{}
}

func (s *LocalProvider) Module(plugin PluginInfo) (string, error) {
	if plugin.Class == plugins.ClassCore && filepath.Base(plugin.FS.Base()) != "dist" {
		return path.Join("core:plugin", filepath.Base(plugin.FS.Base())), nil
	}

	return s.AssetPath(plugin, "module.js")
}

func (s *LocalProvider) AssetPath(plugin PluginInfo, assetPath ...string) (string, error) {
	// Plugins discovered from a remote URL (e.g. cdn_url) are served from there, not from Grafana
	if plugin.FS != nil {
		if u, err := url.Parse(plugin.FS.Base()); err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" {
			return url.JoinPath(plugin.FS.Base(), assetPath...)
		}
	}

	return path.Join("public/plugins", plugin.JsonData.ID, path.Join(assetPath...)), nil
}
