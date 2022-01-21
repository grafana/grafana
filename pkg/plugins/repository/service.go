package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

const (
	grafanaComAPIRoot = "https://grafana.com/api/plugins"
)

type Service struct {
	client *Client

	pluginsPath string
	log         Logger
}

func New(skipTLSVerify bool, grafanaVersion string, logger Logger) *Service {
	return &Service{
		client: newClient(skipTLSVerify, grafanaVersion, logger),
		log:    logger,
	}
}

func ProvideService(cfg *setting.Cfg) *Service {
	logger := newLogger("plugin.repository", true)

	return &Service{
		client:      newClient(false, cfg.BuildVersion, logger),
		pluginsPath: cfg.PluginsPath,
		log:         logger,
	}
}

// Download downloads the requested plugin archive
func (s *Service) Download(ctx context.Context, pluginID, version string) (*PluginArchiveInfo, error) {
	isGrafanaPlugin := false

	if strings.HasPrefix(pluginID, "grafana-") {
		isGrafanaPlugin = true
	}

	pluginMeta, err := s.pluginMetadata(pluginID)
	if err != nil {
		return nil, err
	}

	v, err := s.selectVersion(&pluginMeta, version)
	if err != nil {
		return nil, err
	}

	if version == "" {
		version = v.Version
	}

	// Plugins which are downloaded just as sourcecode zipball from GitHub do not have checksum
	var checksum string
	if v.Arch != nil {
		archMeta, exists := v.Arch[osAndArchString()]
		if !exists {
			archMeta = v.Arch["any"]
		}
		checksum = archMeta.SHA256
	}

	pluginZipURL := fmt.Sprintf("%s/%s/versions/%s/download", grafanaComAPIRoot, pluginID, version)

	return s.client.downloadAndExtract(ctx, pluginID, pluginZipURL, checksum, s.pluginsPath, isGrafanaPlugin, s)
}

func (s *Service) GetDownloadOptions(_ context.Context, pluginID, version string) (*PluginDownloadOptions, error) {
	plugin, err := s.pluginMetadata(pluginID)
	if err != nil {
		return nil, err
	}

	v, err := s.selectVersion(&plugin, version)
	if err != nil {
		return nil, err
	}

	return &PluginDownloadOptions{
		Version:      v.Version,
		PluginZipURL: fmt.Sprintf("%s/%s/versions/%s/download", grafanaComAPIRoot, pluginID, v.Version),
	}, nil
}

func (s *Service) DownloadWithURL(ctx context.Context, pluginID, archiveURL string) (*PluginArchiveInfo, error) {
	return s.client.downloadAndExtract(ctx, pluginID, archiveURL, "", s.pluginsPath, false, s)
}

func (s *Service) pluginMetadata(pluginID string) (Plugin, error) {
	s.log.Debugf("Fetching metadata for plugin \"%s\" from repo %s", pluginID, grafanaComAPIRoot)
	body, err := s.client.sendRequestGetBytes(grafanaComAPIRoot, "repo", pluginID)
	if err != nil {
		return Plugin{}, err
	}

	var data Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		s.log.Error("Failed to unmarshal plugin repo response error", err)
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
func (s *Service) selectVersion(plugin *Plugin, version string) (*Version, error) {
	var ver Version

	latestForArch := latestSupportedVersion(plugin)
	if latestForArch == nil {
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       s.client.fullSystemInfoString(),
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
		s.log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionNotFound{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       s.client.fullSystemInfoString(),
		}
	}

	if !supportsCurrentArch(&ver) {
		s.log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       s.client.fullSystemInfoString(),
		}
	}

	return &ver, nil
}

func supportsCurrentArch(version *Version) bool {
	if version.Arch == nil {
		return true
	}
	for arch := range version.Arch {
		if arch == osAndArchString() || arch == "any" {
			return true
		}
	}
	return false
}

func latestSupportedVersion(plugin *Plugin) *Version {
	for _, v := range plugin.Versions {
		ver := v
		if supportsCurrentArch(&ver) {
			return &ver
		}
	}
	return nil
}
