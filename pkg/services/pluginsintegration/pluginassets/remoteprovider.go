package pluginassets

import (
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	pluginassets2 "github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

var _ pluginassets2.Provider = (*RemoteProvider)(nil)

type RemoteProvider struct {
	grafanaCDNURL  string
	staticRootPath string
	pluginsCDN     *pluginscdn.Service

	localProvider *pluginassets2.LocalProvider
}

func ProvideRemoteProvider(cfg *setting.Cfg, pluginLicensing plugins.Licensing, pluginsCDN *pluginscdn.Service) (*RemoteProvider, error) {
	cdnURL, err := cfg.GetContentDeliveryURL(pluginLicensing.ContentDeliveryPrefix())
	if err != nil {
		return nil, err
	}
	return &RemoteProvider{
		grafanaCDNURL:  cdnURL,
		staticRootPath: cfg.StaticRootPath,
		pluginsCDN:     pluginsCDN,
		localProvider:  pluginassets2.NewLocalProvider(),
	}, nil
}

func (s *RemoteProvider) Module(plugin pluginassets2.PluginInfo) (string, error) {
	if plugin.Class == plugins.ClassCore && filepath.Base(plugin.FS.Base()) != "dist" {
		return path.Join("core:plugin", filepath.Base(plugin.FS.Base())), nil
	}

	return s.AssetPath(plugin, "module.js")
}

func (s *RemoteProvider) AssetPath(plugin pluginassets2.PluginInfo, assetPath ...string) (string, error) {
	pluginFSBase := plugin.FS.Base()

	// If plugin base is already an HTTP/HTTPS URL, use it directly
	if u, err := url.Parse(pluginFSBase); err == nil && httpURL(u) {
		return url.JoinPath(pluginFSBase, assetPath...)
	}

	if relativePath, err := filepath.Rel(s.staticRootPath, pluginFSBase); err == nil {
		relativePath = filepath.ToSlash(relativePath)
		// If plugin lives under Grafana's static root path, and CDN URL is set
		if !strings.Contains(relativePath, "..") && s.grafanaCDNURL != "" {
			base, err := url.JoinPath(s.grafanaCDNURL, "public", relativePath)
			if err != nil {
				return "", err
			}

			return url.JoinPath(base, assetPath...)
		}
	}

	if s.pluginsCDN.PluginSupported(plugin.JsonData.ID) {
		return s.pluginsCDN.AssetURL(plugin.JsonData.ID, plugin.JsonData.Info.Version, path.Join(assetPath...))
	}
	if plugin.Parent != nil && s.pluginsCDN.PluginSupported(plugin.Parent.JsonData.ID) {
		relPath, err := plugin.Parent.FS.Rel(pluginFSBase)
		if err != nil {
			return "", err
		}

		base, err := s.pluginsCDN.AssetURL(plugin.Parent.JsonData.ID, plugin.Parent.JsonData.Info.Version, relPath)
		if err != nil {
			return "", err
		}

		return url.JoinPath(base, assetPath...)
	}

	return s.localProvider.AssetPath(plugin, assetPath...)
}

// httpURL checks if a parsed URL is an HTTP/HTTPS URL
// as opposed to a filesystem path that was parsed as a URL (file://, C:\, /path)
// Note: Only http:// and https:// are supported for plugin assets.
func httpURL(u *url.URL) bool {
	return (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}
