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

const defaultBaseURL = "https://www.grafana.com/api/plugins"

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

	logger := log.NewPrettyLogger("plugin.repository")
	return NewManager(ManagerOpts{
		Client:  NewClient(false, logger),
		BaseURL: defaultBaseURL,
	}), nil
}

type ManagerOpts struct {
	Client  *Client
	BaseURL string
	Logger  log.PrettyLogger
}

func NewManager(opts ...ManagerOpts) *Manager {
	if len(opts) == 0 {
		logger := log.NewPrettyLogger("plugin.repository")
		opts = []ManagerOpts{
			{
				BaseURL: defaultBaseURL,
				Client:  NewClient(false, logger),
				Logger:  logger,
			},
		}
	}

	return &Manager{
		baseURL: opts[0].BaseURL,
		client:  opts[0].Client,
		log:     opts[0].Logger,
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

	return m.client.download(ctx, dlOpts.URL, dlOpts.Checksum)
}

// GetPluginArchiveByURL fetches the requested plugin archive from the provided `pluginZipURL`
func (m *Manager) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string) (*PluginArchive, error) {
	return m.client.download(ctx, pluginZipURL, "")
}

// GetPluginArchiveInfo returns the options for downloading the requested plugin (with optional `version`)
func (m *Manager) GetPluginArchiveInfo(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchiveInfo, error) {
	v, err := m.pluginVersion(pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return &PluginArchiveInfo{
		PluginVersion: v.Version,
		Checksum:      v.Checksum,
		URL:           m.downloadURL(pluginID, v.Version),
	}, nil
}

func (m *Manager) SendReq(url *url.URL, compatOpts ...CompatOpts) ([]byte, error) {
	return m.client.sendReq(url, compatOpts...)
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
	return fmt.Sprintf("%s/%s/versions/%s/download", m.baseURL, pluginID, version)
}

// grafanaCompatiblePluginVersions will get version info from /api/plugins/repo/$pluginID based on
// the provided compatibility information (sent via HTTP headers)
func (m *Manager) grafanaCompatiblePluginVersions(pluginID string, compatOpts CompatOpts) ([]Version, error) {
	u, err := url.Parse(m.baseURL)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "repo", pluginID)

	body, err := m.client.sendReq(u, compatOpts)
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
