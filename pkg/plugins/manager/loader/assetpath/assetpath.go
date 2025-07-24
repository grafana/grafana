package assetpath

import (
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

// Service provides methods for constructing asset paths for plugins.
// It supports core plugins, external plugins stored on the local filesystem, and external plugins stored
// on the plugins CDN, and it will switch to the correct implementation depending on the plugin and the config.
type Service struct {
	cdn           *pluginscdn.Service
	cfg           *config.PluginManagementCfg
	assetProvider pluginassets.Provider
}

func ProvideService(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service, assetProvider pluginassets.Provider) *Service {
	return &Service{cfg: cfg, cdn: cdn, assetProvider: assetProvider}
}

func DefaultService(cfg *config.PluginManagementCfg) *Service {
	return &Service{cfg: cfg, cdn: pluginscdn.ProvideService(cfg), assetProvider: fakes.NewFakeAssetProvider()}
}

// Base returns the base path for the specified plugin.
func (s *Service) Base(n pluginassets.PluginInfo) (string, error) {
	if s.cfg.Features.PluginAssetProvider {
		return s.assetProvider.AssetPath(n)
	}

	if n.Class == plugins.ClassCDN {
		return n.FS.Base(), nil
	}
	if s.cdn.PluginSupported(n.JsonData.ID) {
		return s.cdn.AssetURL(n.JsonData.ID, n.JsonData.Info.Version, "")
	}
	if n.Parent != nil {
		relPath, err := n.Parent.FS.Rel(n.FS.Base())
		if err != nil {
			return "", err
		}
		if s.cdn.PluginSupported(n.Parent.JsonData.ID) {
			return s.cdn.AssetURL(n.Parent.JsonData.ID, n.Parent.JsonData.Info.Version, relPath)
		}
	}

	return path.Join("public/plugins", n.JsonData.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s *Service) Module(n pluginassets.PluginInfo) (string, error) {
	if s.cfg.Features.PluginAssetProvider {
		return s.assetProvider.Module(n)
	}

	if n.Class == plugins.ClassCore && filepath.Base(n.FS.Base()) != "dist" {
		return path.Join("core:plugin", filepath.Base(n.FS.Base())), nil
	}

	return s.RelativeURL(n, "module.js")
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
func (s *Service) RelativeURL(n pluginassets.PluginInfo, pathStr string) (string, error) {
	if s.cfg.Features.PluginAssetProvider {
		return s.assetProvider.AssetPath(n, pathStr)
	}

	if n.Class == plugins.ClassCDN {
		return pluginscdn.JoinPath(n.FS.Base(), pathStr)
	}

	if s.cdn.PluginSupported(n.JsonData.ID) {
		return s.cdn.NewCDNURLConstructor(n.JsonData.ID, n.JsonData.Info.Version).StringPath(pathStr)
	}
	if n.Parent != nil {
		if s.cdn.PluginSupported(n.Parent.JsonData.ID) {
			relPath, err := n.Parent.FS.Rel(n.FS.Base())
			if err != nil {
				return "", err
			}
			return s.cdn.AssetURL(n.Parent.JsonData.ID, n.Parent.JsonData.Info.Version, path.Join(relPath, pathStr))
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

func (s *Service) GetTranslations(n pluginassets.PluginInfo) (map[string]string, error) {
	pathToTranslations, err := s.RelativeURL(n, "locales")
	if err != nil {
		return nil, fmt.Errorf("get locales: %w", err)
	}

	// loop through all the languages specified in the plugin.json and add them to the list
	translations := map[string]string{}
	for _, language := range n.JsonData.Languages {
		file := fmt.Sprintf("%s.json", n.JsonData.ID)
		translations[language], err = url.JoinPath(pathToTranslations, language, file)
		if err != nil {
			return nil, fmt.Errorf("join path: %w", err)
		}
	}

	return translations, nil
}
