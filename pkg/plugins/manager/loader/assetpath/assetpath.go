package assetpath

import (
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

// Service provides methods for constructing asset paths for plugins.
// It supports core plugins, external plugins stored on the local filesystem, and external plugins stored
// on the plugins CDN, and it will switch to the correct implementation depending on the plugin and the config.
type Service struct {
	cdn *pluginscdn.Service
	cfg *setting.Cfg
}

func ProvideService(cdn *pluginscdn.Service, cfg *setting.Cfg) *Service {
	return &Service{cdn: cdn, cfg: cfg}
}

// Base returns the base path for the specified plugin.
func (s *Service) Base(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.ClassCore {
		return path.Join("public/app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir)), nil
	}
	if s.cdn.PluginSupported(pluginJSON.ID) {
		return s.cdn.AssetURL(pluginJSON.ID, pluginJSON.Info.Version, "")
	}
	return path.Join("public/plugins", pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s *Service) Module(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.ClassCore {
		return path.Join("app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir), "module"), nil
	}
	if s.cdn.PluginSupported(pluginJSON.ID) {
		return s.cdn.AssetURL(pluginJSON.ID, pluginJSON.Info.Version, "module.js")
	}
	// path := fmt.Sprintf("%s%s", s.cfg.AppURL, path.Join(s.cfg.AppSubURL, "public", "plugins", pluginJSON.ID, "module.js"))
	path := path.Join("public", "plugins", pluginJSON.ID, "module.js")
	return fmt.Sprintf("%s%s", "./", path), nil
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
// If pathStr is an empty string, defaultStr is returned.
func (s *Service) RelativeURL(p *plugins.Plugin, pathStr, defaultStr string) (string, error) {
	if pathStr == "" {
		return defaultStr, nil
	}
	if s.cdn.PluginSupported(p.ID) {
		// CDN
		return s.cdn.NewCDNURLConstructor(p.ID, p.Info.Version).StringPath(pathStr)
	}
	// Local
	u, err := url.Parse(pathStr)
	if err != nil {
		return "", fmt.Errorf("url parse: %w", err)
	}
	if u.IsAbs() {
		return pathStr, nil
	}
	// is set as default or has already been prefixed with base path
	if pathStr == defaultStr || strings.HasPrefix(pathStr, p.BaseURL) {
		return pathStr, nil
	}
	return path.Join(p.BaseURL, pathStr), nil
}
