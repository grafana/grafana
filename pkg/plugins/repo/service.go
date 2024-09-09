package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

func ProvideService(cfg *config.PluginManagementCfg) (*Manager, error) {
	baseURL, err := url.JoinPath(cfg.GrafanaComAPIURL, "/plugins")
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
func (m *Manager) GetPluginArchiveInfo(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (*PluginArchiveInfo, error) {
	v, err := m.PluginVersion(ctx, pluginID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	return &PluginArchiveInfo{
		Version:  v.Version,
		Checksum: v.Checksum,
		URL:      m.downloadURL(pluginID, v.Version),
	}, nil
}

// PluginVersion will return plugin version based on the requested information
func (m *Manager) PluginVersion(ctx context.Context, pluginID, version string, compatOpts CompatOpts) (VersionData, error) {
	versions, err := m.grafanaCompatiblePluginVersions(ctx, pluginID, compatOpts)
	if err != nil {
		return VersionData{}, err
	}

	compatibleVer, err := SelectSystemCompatibleVersion(m.log, versions, pluginID, version, compatOpts)
	if err != nil {
		return VersionData{}, err
	}

	isGrafanaCorePlugin := strings.HasPrefix(compatibleVer.URL, "https://github.com/grafana/grafana/tree/main/public/app/plugins/")
	_, hasAnyArch := compatibleVer.Arch["any"]
	if isGrafanaCorePlugin && hasAnyArch {
		// Trying to install a coupled core plugin
		return VersionData{}, ErrCorePlugin(pluginID)
	}

	return compatibleVer, nil
}

func (m *Manager) downloadURL(pluginID, version string) string {
	return fmt.Sprintf("%s/%s/versions/%s/download", m.baseURL, pluginID, version)
}

// grafanaCompatiblePluginVersions will get version info from /api/plugins/$pluginID/versions
func (m *Manager) grafanaCompatiblePluginVersions(ctx context.Context, pluginID string, compatOpts CompatOpts) ([]Version, error) {
	u, err := url.Parse(m.baseURL)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, pluginID, "versions")

	body, err := m.client.SendReq(ctx, u, compatOpts)
	if err != nil {
		return nil, err
	}

	var v PluginVersions
	err = json.Unmarshal(body, &v)
	if err != nil {
		m.log.Error("Failed to unmarshal plugin repo response", err)
		return nil, err
	}

	if len(v.Versions) == 0 {
		// /plugins/{pluginId}/versions returns 200 even if the plugin doesn't exists
		// but the response is empty. In this case we return 404.
		return nil, newErrResponse4xx(http.StatusNotFound).withMessage("Plugin not found")
	}

	return v.Versions, nil
}
