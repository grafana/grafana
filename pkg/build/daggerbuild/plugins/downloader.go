package plugins

import (
	"fmt"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
)

const (
	// GrafanaPluginAPIURL is the base URL for downloading plugins from grafana.com
	GrafanaPluginAPIURL = "https://grafana.com/api/plugins"
	// AlpineImage is the Alpine image used for downloading plugins
	AlpineImage = "alpine:3.23.2"
)

// DownloadOpts contains options for downloading plugins.
type DownloadOpts struct {
	// Plugins is the list of plugins to download
	Plugins []arguments.CatalogPluginSpec
	// Distribution is the target OS/arch for the plugins
	Distribution backend.Distribution
}

// DownloadPlugins creates a Dagger container that downloads the specified plugins
// and returns a directory containing the extracted plugins.
func DownloadPlugins(client *dagger.Client, opts *DownloadOpts) *dagger.Directory {
	if len(opts.Plugins) == 0 {
		// Return an empty directory if no plugins specified
		return client.Directory()
	}

	os, arch := backend.OSAndArch(opts.Distribution)
	// Map Go arch names to Grafana plugin API arch names
	pluginArch := mapArchToPluginArch(arch)

	container := client.Container().
		From(AlpineImage).
		WithExec([]string{"apk", "add", "--no-cache", "curl", "unzip"}).
		WithWorkdir("/plugins")

	for _, plugin := range opts.Plugins {
		downloadURL := buildPluginDownloadURL(plugin.ID, plugin.Version, os, pluginArch)
		zipFile := fmt.Sprintf("/tmp/%s-%s.zip", plugin.ID, plugin.Version)
		pluginDir := fmt.Sprintf("/plugins/%s", plugin.ID)

		// Download the plugin zip
		container = container.WithExec([]string{
			"curl", "-fSL", "-o", zipFile, downloadURL,
		})

		// Verify checksum if provided
		if plugin.Checksum != "" {
			checksum := strings.TrimPrefix(plugin.Checksum, "sha256:")
			container = container.WithExec([]string{
				"/bin/sh", "-c",
				fmt.Sprintf(`echo "%s  %s" | sha256sum -c -`, checksum, zipFile),
			})
		}

		// Create plugin directory and extract
		container = container.
			WithExec([]string{"mkdir", "-p", pluginDir}).
			WithExec([]string{"unzip", "-q", "-o", zipFile, "-d", "/tmp/extract"}).
			// Move extracted contents to plugin directory (handle nested directory structure)
			WithExec([]string{
				"/bin/sh", "-c",
				fmt.Sprintf(`mv /tmp/extract/*/* %s/ 2>/dev/null || mv /tmp/extract/* %s/`, pluginDir, pluginDir),
			}).
			WithExec([]string{"rm", "-rf", "/tmp/extract", zipFile})
	}

	return container.Directory("/plugins")
}

// buildPluginDownloadURL constructs the URL for downloading a plugin from grafana.com.
func buildPluginDownloadURL(id, version, os, arch string) string {
	return fmt.Sprintf("%s/%s/versions/%s/download?os=%s&arch=%s",
		GrafanaPluginAPIURL, id, version, os, arch)
}

// mapArchToPluginArch maps Go architecture names to Grafana plugin API architecture names.
func mapArchToPluginArch(goArch string) string {
	switch goArch {
	case "amd64":
		return "amd64"
	case "arm64":
		return "arm64"
	case "arm":
		return "arm"
	case "386":
		return "386"
	default:
		// Default to amd64 for unknown architectures
		return "amd64"
	}
}

// PluginDownloadInfo contains information about a plugin download for logging.
type PluginDownloadInfo struct {
	ID      string
	Version string
	URL     string
}

// GetPluginDownloadInfos returns download information for the specified plugins.
func GetPluginDownloadInfos(plugins []arguments.CatalogPluginSpec, distro backend.Distribution) []PluginDownloadInfo {
	os, arch := backend.OSAndArch(distro)
	pluginArch := mapArchToPluginArch(arch)

	infos := make([]PluginDownloadInfo, len(plugins))
	for i, plugin := range plugins {
		infos[i] = PluginDownloadInfo{
			ID:      plugin.ID,
			Version: plugin.Version,
			URL:     buildPluginDownloadURL(plugin.ID, plugin.Version, os, pluginArch),
		}
	}
	return infos
}
