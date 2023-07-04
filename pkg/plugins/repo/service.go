package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Manager struct {
	client  *Client
	baseURL string

	log log.PrettyLogger
}

func ProvideService(cfg *config.Cfg) (*Manager, error) {
	baseURL, err := url.JoinPath(cfg.GrafanaComURL, "/api/plugins")
	if err != nil {
		return nil, err
	}

	return NewManager(ManagerCfg{
		SkipTLSVerify: false,
		BaseURL:       baseURL,
		Logger:        log.NewPrettyLogger("plugin.repository"),
	}), nil
}

type ManagerCfg struct {
	SkipTLSVerify bool
	BaseURL       string
	Logger        log.PrettyLogger
}

func NewManager(cfg ManagerCfg) *Manager {
	return &Manager{
		baseURL: cfg.BaseURL,
		client:  NewClient(cfg.SkipTLSVerify, cfg.Logger),
		log:     cfg.Logger,
	}
}

// GetPluginArchive fetches the requested plugin archive
func (m *Manager) GetPluginArchive(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchive, error) {
	dlOpts, err := m.GetPluginArchiveInfo(ctx, pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return m.client.Download(ctx, dlOpts.URL, dlOpts.Checksum, compatOpts)
}

// GetPluginArchiveByURL fetches the requested plugin archive from the provided `pluginZipURL`
func (m *Manager) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string, compatOpts CompatOpts) (*PluginArchive, error) {
	return m.client.Download(ctx, pluginZipURL, "", compatOpts)
}

// GetPluginArchiveInfo returns the options for downloading the requested plugin (with optional `version`)
func (m *Manager) GetPluginArchiveInfo(_ context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchiveInfo, error) {
	v, err := m.pluginVersion(pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return &PluginArchiveInfo{
		Version:  v.Version,
		Checksum: v.Checksum,
		URL:      m.downloadURL(pluginID, v.Version),
	}, nil
}

// pluginVersion will return plugin version based on the requested information
func (m *Manager) pluginVersion(pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	versions, err := m.grafanaCompatiblePluginVersions(pluginID, compatOpts)
	if err != nil {
		return VersionData{}, err
	}

	sysCompatOpts, exists := compatOpts.System()
	if !exists {
		return VersionData{}, errors.New("no system compatibility requirements set")
	}

	return SelectSystemCompatibleVersion(m.log, versions, pluginID, version, sysCompatOpts)
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
