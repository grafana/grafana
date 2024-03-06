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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Service provides methods for constructing asset paths for plugins.
// It supports core plugins, external plugins stored on the local filesystem, and external plugins stored
// on the plugins CDN, and it will switch to the correct implementation depending on the plugin and the config.
type Service struct {
	cdn *pluginscdn.Service
	cfg *config.PluginManagementCfg
}

func ProvideService(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service) *Service {
	return &Service{cfg: cfg, cdn: cdn}
}

type PluginInfo struct {
	pluginJSON plugins.JSONData
	class      plugins.Class
	dir        string
}

func NewPluginInfo(pluginJSON plugins.JSONData, class plugins.Class, fs plugins.FS) PluginInfo {
	return PluginInfo{
		pluginJSON: pluginJSON,
		class:      class,
		dir:        fs.Base(),
	}
}

func DefaultService(cfg *config.PluginManagementCfg) *Service {
	return &Service{cfg: cfg, cdn: pluginscdn.ProvideService(cfg)}
}

// Base returns the base path for the specified plugin.
func (s *Service) Base(n PluginInfo) (string, error) {
	if n.class == plugins.ClassCore {
		baseDir := getBaseDir(n.dir)
		return path.Join("public/app/plugins", string(n.pluginJSON.Type), baseDir), nil
	}
	if s.cdn.PluginSupported(n.pluginJSON.ID) {
		return s.cdn.AssetURL(n.pluginJSON.ID, n.pluginJSON.Info.Version, "")
	}
	return path.Join("public/plugins", n.pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s *Service) Module(n PluginInfo) (string, error) {
	if n.class == plugins.ClassCore {
		if s.cfg.Features != nil &&
			s.cfg.Features.IsEnabledGlobally(featuremgmt.FlagExternalCorePlugins) &&
			filepath.Base(n.dir) == "dist" {
			// The core plugin has been built externally, use the module from the dist folder
		} else {
			baseDir := getBaseDir(n.dir)
			return path.Join("core:plugin", baseDir), nil
		}
	}
	if s.cdn.PluginSupported(n.pluginJSON.ID) {
		return s.cdn.AssetURL(n.pluginJSON.ID, n.pluginJSON.Info.Version, "module.js")
	}
	return path.Join("public/plugins", n.pluginJSON.ID, "module.js"), nil
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
func (s *Service) RelativeURL(n PluginInfo, pathStr string) (string, error) {
	if s.cdn.PluginSupported(n.pluginJSON.ID) {
		return s.cdn.NewCDNURLConstructor(n.pluginJSON.ID, n.pluginJSON.Info.Version).StringPath(pathStr)
	}
	// Local
	u, err := url.Parse(pathStr)
	if err != nil {
		return "", fmt.Errorf("url parse: %w", err)
	}
	if u.IsAbs() {
		return pathStr, nil
	}

	baseURL, err := s.Base(n)
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
	return path.Join("public/img", fmt.Sprintf("icn-%s.svg", string(pluginType)))
}

func getBaseDir(pluginDir string) string {
	baseDir := filepath.Base(pluginDir)
	// Decoupled core plugins will be suffixed with "dist" if they have been built
	if baseDir == "dist" {
		return filepath.Base(strings.TrimSuffix(pluginDir, baseDir))
	}
	return baseDir
}
