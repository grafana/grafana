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
	cfg *config.PluginManagementCfg
}

func ProvideService(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service) *Service {
	return &Service{cfg: cfg, cdn: cdn}
}

type PluginInfo struct {
	pluginJSON plugins.JSONData
	class      plugins.Class
	fs         plugins.FS
	parent     *PluginInfo
}

func NewPluginInfo(pluginJSON plugins.JSONData, class plugins.Class, fs plugins.FS, parent *PluginInfo) PluginInfo {
	return PluginInfo{
		pluginJSON: pluginJSON,
		class:      class,
		fs:         fs,
		parent:     parent,
	}
}

func DefaultService(cfg *config.PluginManagementCfg) *Service {
	return &Service{cfg: cfg, cdn: pluginscdn.ProvideService(cfg)}
}

// Base returns the base path for the specified plugin.
func (s *Service) Base(n PluginInfo) (string, error) {
	if n.class == plugins.ClassCDN {
		return n.fs.Base(), nil
	}
	if s.cdn.PluginSupported(n.pluginJSON.ID) {
		return s.cdn.AssetURL(n.pluginJSON.ID, n.pluginJSON.Info.Version, "")
	}
	if n.parent != nil {
		relPath, err := n.parent.fs.Rel(n.fs.Base())
		if err != nil {
			return "", err
		}
		if s.cdn.PluginSupported(n.parent.pluginJSON.ID) {
			return s.cdn.AssetURL(n.parent.pluginJSON.ID, n.parent.pluginJSON.Info.Version, relPath)
		}
	}

	return path.Join("public/plugins", n.pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s *Service) Module(n PluginInfo) (string, error) {
	if n.class == plugins.ClassCore {
		if filepath.Base(n.fs.Base()) != "dist" {
			return path.Join("core:plugin", filepath.Base(n.fs.Base())), nil
		}
	}

	return s.RelativeURL(n, "module.js")
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
func (s *Service) RelativeURL(n PluginInfo, pathStr string) (string, error) {
	if n.class == plugins.ClassCDN {
		return pluginscdn.JoinPath(n.fs.Base(), pathStr)
	}

	if s.cdn.PluginSupported(n.pluginJSON.ID) {
		return s.cdn.NewCDNURLConstructor(n.pluginJSON.ID, n.pluginJSON.Info.Version).StringPath(pathStr)
	}
	if n.parent != nil {
		if s.cdn.PluginSupported(n.parent.pluginJSON.ID) {
			relPath, err := n.parent.fs.Rel(n.fs.Base())
			if err != nil {
				return "", err
			}
			return s.cdn.AssetURL(n.parent.pluginJSON.ID, n.parent.pluginJSON.Info.Version, path.Join(relPath, pathStr))
		}
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

func (s *Service) GetTranslations(n PluginInfo) (map[string]string, error) {
	pathToTranslations, err := s.RelativeURL(n, "locales")
	if err != nil {
		return nil, fmt.Errorf("get locales: %w", err)
	}

	// loop through all the languages specified in the plugin.json and add them to the list
	translations := map[string]string{}
	for _, language := range n.pluginJSON.Languages {
		file := fmt.Sprintf("%s.json", n.pluginJSON.ID)
		translations[language], err = url.JoinPath(pathToTranslations, language, file)
		if err != nil {
			return nil, fmt.Errorf("join path: %w", err)
		}
	}

	return translations, nil
}
