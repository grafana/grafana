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
	baseURL string
	client  *Client

	log log.PrettyLogger
}

func ProvideService(cfg *config.Cfg) (*Manager, error) {
	defaultBaseURL, err := url.JoinPath(cfg.GrafanaComURL, "/api/plugins")
	if err != nil {
		return nil, err
	}

	logger := log.NewPrettyLogger("plugin.repository")
	return New(defaultBaseURL, NewClient(false, logger), logger), nil
}

func New(baseURL string, client *Client, logger log.PrettyLogger) *Manager {
	return &Manager{
		baseURL: baseURL,
		client:  client,
		log:     logger,
	}
}

type Cfg struct {
	BaseURL string
}

// GetPluginArchive fetches the requested plugin archive
func (m *Manager) GetPluginArchive(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchive, error) {
	dlOpts, err := m.GetPluginArchiveInfo(ctx, pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return m.client.download(ctx, dlOpts.PluginZipURL, dlOpts.Checksum)
}

// GetPluginArchiveByURL fetches the requested plugin archive from the provided `pluginZipURL`
func (m *Manager) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string) (*PluginArchive, error) {
	return m.client.download(ctx, pluginZipURL, "")
}

// GetPluginDownloadOptions returns the options for downloading the requested plugin (with optional `version`)
<<<<<<< Updated upstream
func (m *Manager) GetPluginDownloadOptions(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginDownloadOptions, error) {
	v, err := m.pluginVersion(pluginID, version, compatOpts)
=======
func (m *Manager) GetPluginArchiveInfo(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginDownloadOptions, error) {
	plugin, err := m.pluginMetadata(pluginID, compatOpts)
>>>>>>> Stashed changes
	if err != nil {
		return nil, err
	}

	return &PluginDownloadOptions{
		Version:      v.Version,
		Checksum:     v.Checksum,
		PluginZipURL: m.downloadURL(pluginID, v.Version),
	}, nil
}

type VersionData struct {
	Version     string
	Checksum    string
	DownloadURL string
}

// pluginVersion will return plugin version based on the requested information
func (m *Manager) pluginVersion(pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	versions, err := m.grafanaCompatiblePluginVersions(pluginID, compatOpts)
	if err != nil {
		return VersionData{}, err
	}
	return m.SelectSystemCompatibleVersion(versions, pluginID, version, compatOpts)
}

// SelectSystemCompatibleVersion selects the most appropriate plugin version based on os + architecture
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func (m *Manager) SelectSystemCompatibleVersion(versions []Version, pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	version = normalizeVersion(version)

	var ver Version
	latestForArch, exists := latestSupportedVersion(versions, compatOpts)
	if !exists {
		return VersionData{}, ErrArcNotFound{
			PluginID:   pluginID,
			SystemInfo: compatOpts.String(),
		}
	}

	if version == "" {
		return VersionData{
			Version:  latestForArch.Version,
			Checksum: checksum(latestForArch, compatOpts),
		}, nil
	}
	for _, v := range versions {
		if v.Version == version {
			ver = v
			break
		}
	}

	if len(ver.Version) == 0 {
		m.log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionNotFound{
			PluginID:         pluginID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	if !supportsCurrentArch(ver, compatOpts) {
		m.log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return VersionData{}, ErrVersionUnsupported{
			PluginID:         pluginID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	return VersionData{
		Version:     ver.Version,
		Checksum:    checksum(ver, compatOpts),
		DownloadURL: m.downloadURL(pluginID, ver.Version),
	}, nil
}

func checksum(v Version, compatOpts CompatOpts) string {
	if v.Arch != nil {
		archMeta, exists := v.Arch[compatOpts.OSAndArch()]
		if !exists {
			archMeta = v.Arch["any"]
		}
		return archMeta.SHA256
	}
	return ""
}

func supportsCurrentArch(version Version, compatOpts CompatOpts) bool {
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

func latestSupportedVersion(versions []Version, compatOpts CompatOpts) (Version, bool) {
	for _, v := range versions {
		if supportsCurrentArch(v, compatOpts) {
			return v, true
		}
	}
	return Version{}, false
}

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}

func (m *Manager) downloadURL(pluginID, version string) string {
	return fmt.Sprintf("%s/%s/version/%s/download", m.baseURL, pluginID, version)
}

// grafanaCompatiblePluginVersions will get version info from /api/plugins/repo/$pluginID based on
// the provided compatibility information (sent via HTTP headers)
func (m *Manager) grafanaCompatiblePluginVersions(pluginID string, compatOpts CompatOpts) ([]Version, error) {
	u, err := url.Parse(m.baseURL)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "repo", pluginID)

	body, err := m.client.SendReq(u, compatOpts)
	if err != nil {
		return nil, err
	}

	var v PluginRepo
	err = json.Unmarshal(body, &v)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin repo response", err)
		return nil, err
	}

	return v.Versions, nil
}
