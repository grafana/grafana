package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Manager struct {
	cfg    Cfg
	client *Client

	log log.PrettyLogger
}

func ProvideService(cfg *config.Cfg) (*Manager, error) {
	defaultBaseURL, err := url.JoinPath(cfg.GrafanaComURL, "/api/plugins")
	if err != nil {
		return nil, err
	}
	return New(Cfg{
		BaseURL:       defaultBaseURL,
		SkipTLSVerify: false,
	}, log.NewPrettyLogger("plugin.repository")), nil
}

func New(cfg Cfg, logger log.PrettyLogger) *Manager {
	return &Manager{
		cfg:    cfg,
		client: newClient(cfg.SkipTLSVerify, logger),
		log:    logger,
	}
}

type Cfg struct {
	BaseURL       string
	SkipTLSVerify bool
}

// GetPluginArchive fetches the requested plugin archive
func (m *Manager) GetPluginArchive(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchive, error) {
	dlOpts, err := m.GetPluginDownloadOptions(ctx, pluginID, version, compatOpts)
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
func (m *Manager) GetPluginDownloadOptions(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginDownloadOptions, error) {
	v, err := m.pluginVersion(pluginID, version, compatOpts)
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
		PluginZipURL: m.downloadURL(pluginID, v.Version),
	}, nil
}

// pluginVersion will return plugin version based on the requested information
func (m *Manager) pluginVersion(pluginID, version string, compatOpts CompatOpts) (*Version, error) {
	if compatOpts.AnyGrafanaVersion() {
		if version == "" {
			v, err := m.latestPluginVersion(pluginID)
			if err != nil {
				return nil, err
			}
			return m.selectSystemCompatibleVersion([]Version{v}, pluginID, version, compatOpts)
		}
		v, err := m.specificPluginVersion(pluginID, version)
		if err != nil {
			return nil, err
		}
		return m.selectSystemCompatibleVersion([]Version{v}, pluginID, version, compatOpts)
	}

	versions, err := m.grafanaCompatiblePluginVersions(pluginID, compatOpts)
	if err != nil {
		return nil, err
	}
	return m.selectSystemCompatibleVersion(versions, pluginID, version, compatOpts)
}

// selectSystemCompatibleVersion selects the most appropriate plugin version based on os + architecture
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func (m *Manager) selectSystemCompatibleVersion(versions []Version, pluginID, version string, compatOpts CompatOpts) (*Version, error) {
	version = normalizeVersion(version)

	var ver Version
	latestForArch := latestSupportedVersion(versions, compatOpts)
	if latestForArch == nil {
		return nil, ErrArcNotFound{
			PluginID:   pluginID,
			SystemInfo: compatOpts.String(),
		}
	}

	if version == "" {
		return latestForArch, nil
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
		return nil, ErrVersionNotFound{
			PluginID:         pluginID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
		}
	}

	if !supportsCurrentArch(&ver, compatOpts) {
		m.log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			pluginID, version, latestForArch.Version)
		return nil, ErrVersionUnsupported{
			PluginID:         pluginID,
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

func latestSupportedVersion(versions []Version, compatOpts CompatOpts) *Version {
	for _, v := range versions {
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

func (m *Manager) downloadURL(pluginID, version string) string {
	return fmt.Sprintf("%s/%s/version/%s/download", m.cfg.BaseURL, pluginID, version)
}

// specificPluginVersion returns specific plugin version information from /api/plugins/$pluginID/version/$version
// regardless of the Grafana version
func (m *Manager) specificPluginVersion(pluginID, version string) (Version, error) {
	u, err := url.Parse(m.cfg.BaseURL)
	if err != nil {
		return Version{}, err
	}
	u.Path = path.Join(u.Path, pluginID, "version", version)

	body, err := m.client.sendReq(u)
	if err != nil {
		return Version{}, err
	}

	var pv PluginVersion
	err = json.Unmarshal(body, &pv)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin version response", err)
		return Version{}, err
	}

	archMeta := make(map[string]ArchMeta)
	for _, p := range pv.Packages {
		archMeta[p.PackageName] = ArchMeta{SHA256: p.Sha256}
	}

	return Version{Version: version, Arch: archMeta}, nil
}

// latestPluginVersionNumber will get latest version from /api/plugins/$pluginID
// regardless of the Grafana version
func (m *Manager) latestPluginVersion(pluginID string) (Version, error) {
	u, err := url.Parse(m.cfg.BaseURL)
	if err != nil {
		return Version{}, err
	}
	u.Path = path.Join(u.Path, pluginID)

	body, err := m.client.sendReq(u)
	if err != nil {
		return Version{}, err
	}
	var pv Plugin
	err = json.Unmarshal(body, &pv)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin version response", err)
		return Version{}, err
	}

	if pv.Status != "active" || pv.VersionStatus != "active" {
		return Version{}, errors.New("plugin is not active")
	}

	archMeta := make(map[string]ArchMeta)
	for _, p := range pv.Packages {
		archMeta[p.PackageName] = ArchMeta{SHA256: p.Sha256}
	}

	return Version{Version: pv.Version, Arch: archMeta}, nil
}

// grafanaCompatiblePluginVersions will get version info from /api/plugins/repo/$pluginID based on
// the provided compatibility information (sent via HTTP headers)
func (m *Manager) grafanaCompatiblePluginVersions(pluginID string, compatOpts CompatOpts) ([]Version, error) {
	u, err := url.Parse(m.cfg.BaseURL)
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
