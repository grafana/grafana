package plugins

import (
	"fmt"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/plugins/repo"
)

const (
	// GrafanaComAPIURL is the base URL for grafana.com API (same as used in pkg/plugins/repo)
	GrafanaComAPIURL = "https://grafana.com/api/plugins"
	// AlpineImage is the Alpine image used for downloading plugins
	AlpineImage = "alpine:3.23.2"
)

// DownloadOpts contains options for downloading plugins.
type DownloadOpts struct {
	// Plugins is the list of plugins to download
	Plugins []arguments.CatalogPluginSpec
	// Distribution is the target OS/arch for the plugins
	Distribution backend.Distribution
	// GrafanaVersion is the target Grafana version for compatibility checking (optional)
	GrafanaVersion string
}

// DownloadPlugins creates a Dagger container that downloads the specified plugins
// and returns a directory containing the extracted plugins.
// This reuses URL construction logic compatible with pkg/plugins/repo.
func DownloadPlugins(client *dagger.Client, opts *DownloadOpts) *dagger.Directory {
	if len(opts.Plugins) == 0 {
		// Return an empty directory if no plugins specified
		return client.Directory()
	}

	os, arch := backend.OSAndArch(opts.Distribution)

	container := client.Container().
		From(AlpineImage).
		WithExec([]string{"apk", "add", "--no-cache", "curl", "unzip"}).
		WithWorkdir("/plugins")

	for _, plugin := range opts.Plugins {
		downloadURL := BuildPluginDownloadURL(plugin.ID, plugin.Version)
		zipFile := fmt.Sprintf("/tmp/%s-%s.zip", plugin.ID, plugin.Version)
		pluginDir := fmt.Sprintf("/plugins/%s", plugin.ID)

		// Build curl command with proper headers (matching pkg/plugins/repo/client.go)
		// These headers help the API return the correct platform-specific plugin archive
		curlCmd := []string{
			"curl", "-fSL",
			"-H", fmt.Sprintf("grafana-os: %s", os),
			"-H", fmt.Sprintf("grafana-arch: %s", arch),
			"-H", "User-Agent: grafana-build",
		}

		// Add Grafana version header if specified (for compatibility selection)
		if opts.GrafanaVersion != "" {
			curlCmd = append(curlCmd, "-H", fmt.Sprintf("grafana-version: %s", opts.GrafanaVersion))
		}

		curlCmd = append(curlCmd, "-o", zipFile, downloadURL)

		// Download the plugin zip
		container = container.WithExec(curlCmd)

		// Verify checksum if provided
		if plugin.Checksum != "" {
			checksum := strings.TrimPrefix(plugin.Checksum, "sha256:")
			container = container.WithExec([]string{
				"/bin/sh", "-c",
				fmt.Sprintf(`echo "%s  %s" | sha256sum -c -`, checksum, zipFile),
			})
		}

		// Create plugin directory and extract
		// This mirrors the extraction logic in pkg/plugins/storage/fs.go
		// but adapted for shell execution in a container
		container = container.
			WithExec([]string{"mkdir", "-p", pluginDir}).
			WithExec([]string{"unzip", "-q", "-o", zipFile, "-d", "/tmp/extract"}).
			// Handle nested directory structure (common in plugin zips)
			// The plugin archive typically has a root directory like "plugin-name-version/"
			WithExec([]string{
				"/bin/sh", "-c",
				fmt.Sprintf(`cd /tmp/extract && dir=$(ls -d */ | head -1) && if [ -n "$dir" ]; then mv "$dir"* %s/ 2>/dev/null || mv * %s/; else mv * %s/; fi`, pluginDir, pluginDir, pluginDir),
			}).
			WithExec([]string{"rm", "-rf", "/tmp/extract", zipFile})
	}

	return container.Directory("/plugins")
}

// BuildPluginDownloadURL constructs the URL for downloading a plugin from grafana.com.
// This uses the same URL format as pkg/plugins/repo/service.go:downloadURL
func BuildPluginDownloadURL(pluginID, version string) string {
	return fmt.Sprintf("%s/%s/versions/%s/download", GrafanaComAPIURL, pluginID, version)
}

// NewCompatOpts creates repo.CompatOpts for API requests.
// This allows reusing the version selection logic from pkg/plugins/repo if needed.
func NewCompatOpts(grafanaVersion, os, arch string) repo.CompatOpts {
	if grafanaVersion != "" {
		return repo.NewCompatOpts(grafanaVersion, os, arch)
	}
	return repo.NewSystemCompatOpts(os, arch)
}

// PluginDownloadInfo contains information about a plugin download for logging.
type PluginDownloadInfo struct {
	ID      string
	Version string
	URL     string
}

// GetPluginDownloadInfos returns download information for the specified plugins.
func GetPluginDownloadInfos(plugins []arguments.CatalogPluginSpec, distro backend.Distribution) []PluginDownloadInfo {
	infos := make([]PluginDownloadInfo, len(plugins))
	for i, plugin := range plugins {
		infos[i] = PluginDownloadInfo{
			ID:      plugin.ID,
			Version: plugin.Version,
			URL:     BuildPluginDownloadURL(plugin.ID, plugin.Version),
		}
	}
	return infos
}
