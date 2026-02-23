package plugins

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/plugins/repo"
)

const (
	// GrafanaComAPIURL is the base URL for grafana.com API (same as used in pkg/plugins/repo)
	GrafanaComAPIURL = "https://grafana.com/api/plugins"
	// AlpineImage is the Alpine image used for downloading plugins (includes curl and unzip)
	AlpineImage = "alpine/curl"
	// ExtractPluginScriptPath is the script path used for deterministic plugin extraction.
	ExtractPluginScriptPath = "/usr/local/bin/extract-plugin"
)

const extractPluginScript = `#!/bin/sh
set -eu

extract_dir="$1"
plugin_dir="$2"

mkdir -p "$plugin_dir"

dir_count="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
file_count="$(find "$extract_dir" -mindepth 1 -maxdepth 1 ! -type d | wc -l | tr -d ' ')"

if [ "$dir_count" -eq 1 ] && [ "$file_count" -eq 0 ]; then
	root_dir="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
	cp -a "$root_dir"/. "$plugin_dir"/
else
	cp -a "$extract_dir"/. "$plugin_dir"/
fi
`

// DownloadOpts contains options for downloading plugins.
type DownloadOpts struct {
	// Plugins is the list of plugins to download
	Plugins []arguments.CatalogPluginSpec
	// Distribution is the target OS/arch for the plugins
	Distribution backend.Distribution
	// GrafanaVersion is the target Grafana version for compatibility checking (optional)
	GrafanaVersion string
}

// ResolvedPlugin contains a plugin with resolved version information.
type ResolvedPlugin struct {
	ID       string
	Version  string
	Checksum string
	URL      string
}

// ResolvePluginVersions resolves versions for plugins that don't have a specific version specified.
// For plugins without a version, it queries grafana.com API to find the latest compatible version.
// This happens in Go code before the Dagger container starts.
func ResolvePluginVersions(ctx context.Context, log *slog.Logger, plugins []arguments.CatalogPluginSpec, grafanaVersion string, distro backend.Distribution) ([]ResolvedPlugin, error) {
	if len(plugins) == 0 {
		return nil, nil
	}

	os, arch := backend.OSAndArch(distro)
	repoManager := repo.NewManager(repo.ManagerCfg{
		BaseURL: GrafanaComAPIURL,
	})

	resolved := make([]ResolvedPlugin, 0, len(plugins))

	for _, plugin := range plugins {
		if plugin.Version != "" {
			// Version is specified, use it directly
			log.Info("Using specified plugin version", "plugin", plugin.ID, "version", plugin.Version)
			resolved = append(resolved, ResolvedPlugin{
				ID:       plugin.ID,
				Version:  plugin.Version,
				Checksum: plugin.Checksum,
				URL:      BuildPluginDownloadURL(plugin.ID, plugin.Version),
			})
			continue
		}

		// Version not specified, resolve to latest compatible
		log.Info("Resolving latest compatible version", "plugin", plugin.ID, "grafanaVersion", grafanaVersion, "os", os, "arch", arch)

		compatOpts := NewCompatOpts(grafanaVersion, os, arch)
		archiveInfo, err := repoManager.GetPluginArchiveInfo(ctx, plugin.ID, "", compatOpts)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve version for plugin %s: %w", plugin.ID, err)
		}

		log.Info("Resolved plugin version", "plugin", plugin.ID, "version", archiveInfo.Version, "checksum", archiveInfo.Checksum)

		checksum := plugin.Checksum
		if checksum == "" {
			checksum = archiveInfo.Checksum
		}

		resolved = append(resolved, ResolvedPlugin{
			ID:       plugin.ID,
			Version:  archiveInfo.Version,
			Checksum: checksum,
			URL:      archiveInfo.URL,
		})
	}

	return resolved, nil
}

// DownloadPlugins creates a Dagger container that downloads the specified plugins
// and returns a directory containing the extracted plugins.
// This reuses URL construction logic compatible with pkg/plugins/repo.
func DownloadPlugins(client *dagger.Client, opts *DownloadOpts, resolvedPlugins []ResolvedPlugin) *dagger.Directory {
	if len(resolvedPlugins) == 0 {
		// Return an empty directory if no plugins specified
		return client.Directory()
	}

	os, arch := backend.OSAndArch(opts.Distribution)

	container := client.Container().
		From(AlpineImage).
		WithNewFile(ExtractPluginScriptPath, extractPluginScript, dagger.ContainerWithNewFileOpts{
			Permissions: 0o755,
		}).
		WithWorkdir("/plugins")

	for idx, plugin := range resolvedPlugins {
		zipFile := fmt.Sprintf("/tmp/plugin-%d.zip", idx)
		extractDir := fmt.Sprintf("/tmp/extract-%d", idx)
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

		curlCmd = append(curlCmd, "-o", zipFile, plugin.URL)

		container = container.
			WithExec([]string{"rm", "-rf", pluginDir, extractDir}).
			WithExec([]string{"mkdir", "-p", pluginDir, extractDir})

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
		// but adapted for execution in a container.
		container = container.
			WithExec([]string{"unzip", "-q", "-o", zipFile, "-d", extractDir}).
			WithExec([]string{ExtractPluginScriptPath, extractDir, pluginDir}).
			WithExec([]string{"rm", "-rf", extractDir, zipFile})
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
func GetPluginDownloadInfos(resolved []ResolvedPlugin) []PluginDownloadInfo {
	infos := make([]PluginDownloadInfo, len(resolved))
	for i, plugin := range resolved {
		infos[i] = PluginDownloadInfo{
			ID:      plugin.ID,
			Version: plugin.Version,
			URL:     plugin.URL,
		}
	}
	return infos
}
