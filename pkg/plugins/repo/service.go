package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/log"
)

const defaultBaseURL = "https://grafana.com/api/plugins"

type Manager struct {
	cfg    Cfg
	client *Client

	log log.PrettyLogger
}

func ProvideService() *Manager {
	return New(Cfg{
		BaseURL:       defaultBaseURL,
		SkipTLSVerify: false,
	}, log.NewPrettyLogger("plugin.repository"))
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

	return m.client.download(ctx, dlOpts.PluginZipURL, dlOpts.Checksum, compatOpts)
}

// GetPluginArchiveByURL fetches the requested plugin archive from the provided `pluginZipURL`
func (m *Manager) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string, compatOpts CompatOpts) (*PluginArchive, error) {
	return m.client.download(ctx, pluginZipURL, "", compatOpts)
}

// GetPluginDownloadOptions returns the options for downloading the requested plugin (with optional `version`)
func (m *Manager) GetPluginDownloadOptions(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginDownloadOptions, error) {
	versions, err := m.pluginVersions(pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	v, err := m.selectVersion(versions, pluginID, version, compatOpts)
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

// pluginVersions
func (m *Manager) pluginVersions(pluginID, version string, compatOpts CompatOpts) ([]Version, error) {
	if compatOpts.AnyGrafanaVersion() {
		// if no explicit version requested, get latest version
		if version == "" {
			var err error
			version, err = m.latestPluginVersionNumber(pluginID)
			if err != nil {
				return nil, err
			}
		}
		v, err := m.versionInfo(version)
		if err != nil {
			return nil, err
		}
		return []Version{v}, nil
	}

	v, err := m.repoInfo(pluginID, compatOpts)
	if err != nil {
		return nil, err
	}
	return v.Versions, nil
}

// selectVersion selects the most appropriate plugin version
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func (m *Manager) selectVersion(versions []Version, pluginID, version string, compatOpts CompatOpts) (*Version, error) {
	version = normalizeVersion(version)

	var ver Version
	latestForArch := latestSupportedVersion(versions, compatOpts)
	if latestForArch == nil {
		return nil, ErrVersionUnsupported{
			PluginID:         pluginID,
			RequestedVersion: version,
			SystemInfo:       compatOpts.String(),
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

// versionInfo returns the plugin version information from /api/plugins/$pluginID/version/$version
func (m *Manager) versionInfo(version string) (Version, error) {
	u, err := url.Parse(m.cfg.BaseURL)
	if err != nil {
		return Version{}, err
	}
	u.Path = path.Join(u.Path, "version", version)

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
func (m *Manager) latestPluginVersionNumber(pluginID string) (string, error) {
	u, err := url.Parse(m.cfg.BaseURL)
	if err != nil {
		return "", err
	}
	u.Path = path.Join(u.Path, pluginID)

	body, err := m.client.sendReq(u)
	if err != nil {
		return "", err
	}
	var pv Plugin
	err = json.Unmarshal(body, &pv)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin version response", err)
		return "", err
	}

	if pv.Status != "active" || pv.VersionStatus != "active" {
		return "", errors.New("plugin is not active")
	}

	return pv.Version, nil
}

func (m *Manager) repoInfo(pluginID string, compatOpts CompatOpts) (PluginRepo, error) {
	u, err := url.Parse(m.cfg.BaseURL)
	if err != nil {
		return PluginRepo{}, err
	}

	u.Path = path.Join(u.Path, "repo", pluginID)

	body, err := m.client.sendReq(u, opts{compatOpts})
	if err != nil {
		return PluginRepo{}, err
	}

	var v PluginRepo
	err = json.Unmarshal(body, &v)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin repo response", err)
		return PluginRepo{}, err
	}

	return v, nil
}
