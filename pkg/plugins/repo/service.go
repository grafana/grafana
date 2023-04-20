package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Manager struct {
	client  *Client
	baseURL string

	log log.PrettyLogger
}

func ProvideService(cfg *config.Cfg) (*Manager, error) {
	defaultBaseURL, err := url.JoinPath(cfg.GrafanaComURL, "/api/plugins")
	if err != nil {
		return nil, err
	}
	return New(false, defaultBaseURL, log.NewPrettyLogger("plugin.repository")), nil
}

func New(skipTLSVerify bool, baseURL string, logger log.PrettyLogger) *Manager {
	return &Manager{
		client:  newClient(skipTLSVerify, logger),
		baseURL: baseURL,
		log:     logger,
	}
}

// GetPluginArchive fetches the requested plugin archive
func (m *Manager) GetPluginArchive(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchive, error) {
	dlOpts, err := m.GetPluginDownloadOptions(ctx, pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return m.client.download(ctx, dlOpts.PluginZipURL, dlOpts.Checksum, compatOpts)
}

// GetPluginArchiveByURL fetches the requested plugin archive from the provided `pluginZipURL`
func (m *Manager) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string, compatOpts CompatOpts) (*PluginArchive, error) {
	return m.client.download(ctx, pluginZipURL, "", compatOpts)
}

// GetPluginDownloadOptions returns the options for downloading the requested plugin (with optional `version`)
func (m *Manager) GetPluginDownloadOptions(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginDownloadOptions, error) {
	plugin, err := m.pluginMetadata(pluginID, compatOpts)
	if err != nil {
		return nil, err
	}

	v, err := m.selectVersion(&plugin, version, compatOpts)
	if err != nil {
		return nil, err
	}

	// Plugins which are downloaded just as sourcecode zipball from GitHub do not have checksum
	var checksum string
	if v.Arch != nil {
		archMeta, exists := v.Arch[compatOpts.OSAndArch()]
		if !exists {
			archMeta = v.Arch["any"]
		}
		checksum = archMeta.SHA256
	}

	return &PluginDownloadOptions{
		Version:      v.Version,
		Checksum:     checksum,
		PluginZipURL: fmt.Sprintf("%s/%s/versions/%s/download", m.baseURL, pluginID, v.Version),
	}, nil
}

func (m *Manager) pluginMetadata(pluginID string, compatOpts CompatOpts) (Plugin, error) {
	m.log.Debugf("Fetching metadata for plugin \"%s\" from repo %s", pluginID, m.baseURL)

	u, err := url.Parse(m.baseURL)
	if err != nil {
		return Plugin{}, err
	}
	u.Path = path.Join(u.Path, "repo", pluginID)

	body, err := m.client.sendReq(u, compatOpts)
	if err != nil {
		return Plugin{}, err
	}

	var data Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin repo response error", err)
		return Plugin{}, err
	}

	return data, nil
}

// selectVersion selects the most appropriate plugin version
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func (m *Manager) selectVersion(plugin *Plugin, version string, compatOpts CompatOpts) (*Version, error) {
	version = normalizeVersion(version)

	var ver Version
	latestForArch := latestSupportedVersion(plugin, compatOpts)
	if latestForArch == nil {
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	if version == "" {
		return latestForArch, nil
	}
	for _, v := range plugin.Versions {
		if v.Version == version {
			ver = v
			break
		}
	}

	if len(ver.Version) == 0 {
		m.log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionNotFound{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	if !supportsCurrentArch(&ver, compatOpts) {
		m.log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	return &ver, nil
}

func supportsCurrentArch(version *Version, compatOpts CompatOpts) bool {
	if version.Arch == nil {
		return true
	}
	for arch := range version.Arch {
		if arch == compatOpts.OSAndArch() || arch == "any" {
			return true
		}
	}
	return false
}

func latestSupportedVersion(plugin *Plugin, compatOpts CompatOpts) *Version {
	for _, v := range plugin.Versions {
		ver := v
		if supportsCurrentArch(&ver, compatOpts) {
			return &ver
		}
	}
	return nil
}

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}
