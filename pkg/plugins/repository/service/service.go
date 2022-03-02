package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/repository"

	"github.com/grafana/grafana/pkg/plugins/logger"
)

const (
	grafanaComAPIRoot = "https://grafana.com/api/plugins"
)

type Service struct {
	client *Client

	repoURL string
	log     logger.Logger
}

func New(skipTLSVerify bool, repoURL string, logger logger.Logger) *Service {
	return &Service{
		client:  newClient(skipTLSVerify, logger),
		repoURL: repoURL,
		log:     logger,
	}
}

func ProvideService() *Service {
	return New(false, grafanaComAPIRoot, logger.NewLogger("plugin.repository", true))
}

// Download downloads the requested plugin archive
func (s *Service) GetPluginArchive(ctx context.Context, pluginID, version string, opts repository.CompatabilityOpts) (*repository.PluginArchive, error) {
	dlOpts, err := s.GetPluginDownloadOptions(ctx, pluginID, version, opts)
	if err != nil {
		return nil, err
	}

	return s.client.download(ctx, dlOpts.PluginZipURL, dlOpts.Checksum, opts.GrafanaVersion)
}

func (s *Service) GetPluginArchiveByURL(ctx context.Context, pluginZipURL string, opts repository.CompatabilityOpts) (*repository.PluginArchive, error) {
	return s.client.download(ctx, pluginZipURL, "", opts.GrafanaVersion)
}

func (s *Service) GetPluginDownloadOptions(_ context.Context, pluginID, version string, opts repository.CompatabilityOpts) (*repository.PluginDownloadOptions, error) {
	plugin, err := s.pluginMetadata(pluginID, opts.GrafanaVersion)
	if err != nil {
		return nil, err
	}

	v, err := s.selectVersion(&plugin, version, opts.GrafanaVersion)
	if err != nil {
		return nil, err
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

	return &repository.PluginDownloadOptions{
		Version:      v.Version,
		Checksum:     checksum,
		PluginZipURL: fmt.Sprintf("%s/%s/versions/%s/download", grafanaComAPIRoot, pluginID, v.Version),
	}, nil
}

func (s *Service) pluginMetadata(pluginID, grafanaVersion string) (repository.Plugin, error) {
	s.log.Debugf("Fetching metadata for plugin \"%s\" from repo %s", pluginID, s.repoURL)

	u, err := url.Parse(s.repoURL)
	if err != nil {
		return repository.Plugin{}, err
	}
	u.Path = path.Join(u.Path, "repo", pluginID)

	body, err := s.client.sendReq(u, grafanaVersion)
	if err != nil {
		return repository.Plugin{}, err
	}

	var data repository.Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		s.log.Error("Failed to unmarshal plugin repo response error", err)
		return repository.Plugin{}, err
	}

	return data, nil
}

// selectVersion selects the most appropriate plugin version
// returns the specified version if supported.
// returns the latest version if no specific version is specified.
// returns error if the supplied version does not exist.
// returns error if supplied version exists but is not supported.
// NOTE: It expects plugin.Versions to be sorted so the newest version is first.
func (s *Service) selectVersion(plugin *repository.Plugin, version, grafanaVersion string) (*repository.Version, error) {
	version = normalizeVersion(version)

	var ver repository.Version
	latestForArch := latestSupportedVersion(plugin)
	if latestForArch == nil {
		return nil, repository.ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       SystemInfo(grafanaVersion),
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
		return nil, repository.ErrVersionNotFound{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       SystemInfo(grafanaVersion),
		}
	}

	if !supportsCurrentArch(&ver) {
		s.log.Debugf("Requested plugin version %s v%s is not supported on your system but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, repository.ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       SystemInfo(grafanaVersion),
		}
	}

	return &ver, nil
}

func supportsCurrentArch(version *repository.Version) bool {
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

func latestSupportedVersion(plugin *repository.Plugin) *repository.Version {
	for _, v := range plugin.Versions {
		ver := v
		if supportsCurrentArch(&ver) {
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
