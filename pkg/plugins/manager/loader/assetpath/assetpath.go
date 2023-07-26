package assetpath

import (
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

// Service provides methods for constructing asset paths for plugins.
// It supports core plugins, external plugins stored on the local filesystem, and external plugins stored
// on the plugins CDN, and it will switch to the correct implementation depending on the plugin and the config.
type Service struct {
	cdn *pluginscdn.Service
	cfg *config.Cfg
}

func ProvideService(cfg *config.Cfg, cdn *pluginscdn.Service) *Service {
	return &Service{cdn: cdn, cfg: cfg}
}

// Base returns the base path for the specified plugin.
func (s *Service) Base(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.ClassCore {
		return path.Join("/", s.cfg.GrafanaAppSubURL, "/public/app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir)), nil
	}
	if s.cdn.PluginSupported(pluginJSON.ID) {
		return s.cdn.AssetURL(pluginJSON.ID, pluginJSON.Info.Version, "")
	}
	return path.Join("/", s.cfg.GrafanaAppSubURL, "/public/plugins", pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s *Service) Module(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.ClassCore {
		return path.Join("core:plugin", filepath.Base(pluginDir)), nil
	}
	if s.cdn.PluginSupported(pluginJSON.ID) {
		return s.cdn.AssetURL(pluginJSON.ID, pluginJSON.Info.Version, "module.js")
	}
	return path.Join("/", s.cfg.GrafanaAppSubURL, "/public/plugins", pluginJSON.ID, "module.js"), nil
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
func (s *Service) RelativeURL(pluginJSON plugins.JSONData, class plugins.Class, pluginDir, pathStr string) (string, error) {
	if s.cdn.PluginSupported(pluginJSON.ID) {
		return s.cdn.NewCDNURLConstructor(pluginJSON.ID, pluginJSON.Info.Version).StringPath(pathStr)
	}
	// Local
	u, err := url.Parse(pathStr)
	if err != nil {
		return "", fmt.Errorf("url parse: %w", err)
	}
	if u.IsAbs() {
		return pathStr, nil
	}

	baseURL, err := s.Base(pluginJSON, class, pluginDir)
	if err != nil {
		return "", err
	}

	// has already been prefixed with base path
	if strings.HasPrefix(pathStr, baseURL) {
		return pathStr, nil
	}
	return path.Join(baseURL, pathStr), nil
}

// DefaultLogoPath returns the default logo path for the specified plugin type.
func (s *Service) DefaultLogoPath(pluginType plugins.Type) string {
	return path.Join("/", s.cfg.GrafanaAppSubURL, fmt.Sprintf("/public/img/icn-%s.svg", string(pluginType)))
}
