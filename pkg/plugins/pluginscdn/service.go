package pluginscdn

import (
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

const (
	// systemJSCDNKeyword is the path prefix used by system.js to identify the plugins CDN.
	systemJSCDNKeyword = "plugin-cdn"
)

// Service provides methods for constructing asset paths for plugins.
// It supports core plugins, external plugins stored on the local filesystem, and external plugins stored
// on the plugins CDN, and it will switch to the correct implementation depending on the plugin and the config.
type Service struct {
	cfg *config.Cfg
}

func ProvideService(cfg *config.Cfg) *Service {
	return &Service{cfg: cfg}
}

// cdnURLConstructor returns a new URLConstructor for the provided plugin id and version.
// The CDN should be enabled for the plugin, otherwise the returned URLConstructor will have
// and invalid base url.
func (c Service) cdnURLConstructor(pluginID, pluginVersion string) URLConstructor {
	return NewCDNURLConstructor(c.cfg.PluginsCDNURLTemplate, pluginID, pluginVersion)
}

// IsCDNPlugin returns true if the CDN is enabled in the config and if the specified plugin ID has CDN enabled.
func (c Service) IsCDNPlugin(pluginID string) bool {
	return c.cfg.PluginsCDNURLTemplate != "" && c.cfg.PluginSettings[pluginID]["cdn"] != ""
}

// systemJSCDNPath returns a system-js path for the plugin CDN.
// It replaces the base path of the CDN with systemJSCDNKeyword.
// If assetPath is an empty string, the base path for the plugin is returned.
func (c Service) systemJSCDNPath(pluginID, pluginVersion, assetPath string) (string, error) {
	u, err := c.cdnURLConstructor(pluginID, pluginVersion).Path(assetPath)
	if err != nil {
		return "", err
	}
	return path.Join(systemJSCDNKeyword, u.Path), nil
}

// Base returns the base path for the specified plugin.
func (c Service) Base(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.Core {
		return path.Join("public/app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir)), nil
	}
	if c.IsCDNPlugin(pluginJSON.ID) {
		return c.systemJSCDNPath(pluginJSON.ID, pluginJSON.Info.Version, "")
	}
	return path.Join("public/plugins", pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (c Service) Module(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.Core {
		return path.Join("app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir), "module"), nil
	}
	if c.IsCDNPlugin(pluginJSON.ID) {
		return c.systemJSCDNPath(pluginJSON.ID, pluginJSON.Info.Version, "module")
	}
	return path.Join("plugins", pluginJSON.ID, "module"), nil
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
// If pathStr is an empty string, defaultStr is returned.
func (c Service) RelativeURL(p *plugins.Plugin, pathStr, defaultStr string) (string, error) {
	if pathStr == "" {
		return defaultStr, nil
	}
	if c.IsCDNPlugin(p.ID) {
		// CDN
		return c.cdnURLConstructor(p.ID, p.Info.Version).StringURLFor(pathStr)
	}
	// Local
	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr, nil
	}
	// is set as default or has already been prefixed with base path
	if pathStr == defaultStr || strings.HasPrefix(pathStr, p.BaseURL) {
		return pathStr, nil
	}
	return path.Join(p.BaseURL, pathStr), nil
}
