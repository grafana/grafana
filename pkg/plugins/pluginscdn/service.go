package pluginscdn

import (
	"errors"
	"fmt"
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

var (
	ErrPluginNotCDN = errors.New("plugin is not a cdn plugin")
	ErrCDNDisabled  = errors.New("plugins cdn is disabled")
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

// cdnURLConstructor returns a new urlConstructor for the provided plugin id and version.
// The CDN should be enabled for the plugin, otherwise the returned urlConstructor will have
// and invalid base url.
func (s Service) cdnURLConstructor(pluginID, pluginVersion string) urlConstructor {
	return newCDNURLConstructor(s.cfg.PluginsCDNURLTemplate, pluginID, pluginVersion)
}

// HasCDN returns true if the plugins cdn is enabled.
func (s Service) HasCDN() bool {
	return s.cfg.PluginsCDNURLTemplate != ""
}

// IsCDNPlugin returns true if the CDN is enabled in the config and if the specified plugin ID has CDN enabled.
func (s Service) IsCDNPlugin(pluginID string) bool {
	return s.HasCDN() && s.cfg.PluginSettings[pluginID]["cdn"] != ""
}

// CDNBaseURL returns the absolute base URL of the plugins CDN.
// If the plugins CDN is disabled, it returns an ErrCDNDisabled.
func (s Service) CDNBaseURL() (string, error) {
	if !s.HasCDN() {
		return "", ErrCDNDisabled
	}
	u, err := url.Parse(s.cfg.PluginsCDNURLTemplate)
	if err != nil {
		return "", fmt.Errorf("url parse: %w", err)
	}
	return u.Scheme + "://" + u.Host, nil
}

// systemJSCDNPath returns a system-js path for the plugin CDN.
// It replaces the base path of the CDN with systemJSCDNKeyword.
// If assetPath is an empty string, the base path for the plugin is returned.
func (s Service) systemJSCDNPath(pluginID, pluginVersion, assetPath string) (string, error) {
	u, err := s.cdnURLConstructor(pluginID, pluginVersion).path(assetPath)
	if err != nil {
		return "", err
	}
	return path.Join(systemJSCDNKeyword, u.Path), nil
}

// Base returns the base path for the specified plugin.
func (s Service) Base(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.Core {
		return path.Join("public/app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir)), nil
	}
	if s.IsCDNPlugin(pluginJSON.ID) {
		return s.systemJSCDNPath(pluginJSON.ID, pluginJSON.Info.Version, "")
	}
	return path.Join("public/plugins", pluginJSON.ID), nil
}

// Module returns the module.js path for the specified plugin.
func (s Service) Module(pluginJSON plugins.JSONData, class plugins.Class, pluginDir string) (string, error) {
	if class == plugins.Core {
		return path.Join("app/plugins", string(pluginJSON.Type), filepath.Base(pluginDir), "module"), nil
	}
	if s.IsCDNPlugin(pluginJSON.ID) {
		return s.systemJSCDNPath(pluginJSON.ID, pluginJSON.Info.Version, "module")
	}
	return path.Join("plugins", pluginJSON.ID, "module"), nil
}

// RelativeURL returns the relative URL for an arbitrary plugin asset.
// If pathStr is an empty string, defaultStr is returned.
func (s Service) RelativeURL(p *plugins.Plugin, pathStr, defaultStr string) (string, error) {
	if pathStr == "" {
		return defaultStr, nil
	}
	if s.IsCDNPlugin(p.ID) {
		// CDN
		return s.cdnURLConstructor(p.ID, p.Info.Version).stringURLFor(pathStr)
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

// CDNAssetURL returns the URL of a CDN asset for a CDN plugin. If the specified plugin is not a CDN plugin,
// it returns ErrPluginNotCDN.
func (s Service) CDNAssetURL(pluginID, pluginVersion, assetPath string) (string, error) {
	if !s.IsCDNPlugin(pluginID) {
		return "", ErrPluginNotCDN
	}
	return s.cdnURLConstructor(pluginID, pluginVersion).stringURLFor(assetPath)
}
