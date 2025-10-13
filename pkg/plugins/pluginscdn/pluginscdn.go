package pluginscdn

import (
	"errors"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/config"
)

const (
	// cdnAssetPathTemplate is the relative path template used to locate plugin CDN assets
	cdnAssetPathTemplate = "{id}/{version}/public/plugins/{id}/{assetPath}"
)

var ErrPluginNotCDN = errors.New("plugin is not a cdn plugin")

// Service provides methods for the plugins CDN.
type Service struct {
	cfg *config.PluginManagementCfg
}

func ProvideService(cfg *config.PluginManagementCfg) *Service {
	return &Service{cfg: cfg}
}

// NewCDNURLConstructor returns a new URLConstructor for the provided plugin id and version.
// The CDN should be enabled for the plugin, otherwise the returned URLConstructor will have
// and invalid base url.
func (s *Service) NewCDNURLConstructor(pluginID, pluginVersion string) URLConstructor {
	return URLConstructor{
		cdnURLTemplate: strings.TrimRight(s.cfg.PluginsCDNURLTemplate, "/") + "/" + cdnAssetPathTemplate,
		pluginID:       pluginID,
		pluginVersion:  pluginVersion,
	}
}

// IsEnabled returns true if the plugins cdn is enabled.
func (s *Service) IsEnabled() bool {
	return s.cfg.PluginsCDNURLTemplate != ""
}

// PluginSupported returns true if the CDN is enabled in the config and if the specified plugin ID has CDN enabled.
func (s *Service) PluginSupported(pluginID string) bool {
	return s.IsEnabled() && s.cfg.PluginSettings[pluginID]["cdn"] != ""
}

// BaseURL returns the absolute base URL of the plugins CDN.
// This is the "fixed" part of the URL (protocol + host + root url).
// If the plugins CDN is disabled, it returns an empty string.
func (s *Service) BaseURL() (string, error) {
	if !s.IsEnabled() {
		return "", nil
	}
	return s.cfg.PluginsCDNURLTemplate, nil
}

// AssetURL returns the URL of a CDN asset for a CDN plugin. If the specified plugin is not a CDN plugin,
// it returns ErrPluginNotCDN.
func (s *Service) AssetURL(pluginID, pluginVersion, assetPath string) (string, error) {
	if !s.PluginSupported(pluginID) {
		return "", ErrPluginNotCDN
	}
	return s.NewCDNURLConstructor(pluginID, pluginVersion).StringPath(assetPath)
}

func JoinPath(base string, assetPath ...string) (string, error) {
	return url.JoinPath(base, assetPath...)
}
