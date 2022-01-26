package updatechecker

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/hashicorp/go-version"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginsService struct {
	availableUpdates map[string]PluginUpdate

	enabled        bool
	grafanaVersion string
	pluginStore    plugins.Store
	httpClient     http.Client
	log            log.Logger
}

type PluginUpdate struct {
	GcomVersion string
	HasUpdate   bool
}

func ProvidePluginsService(cfg *setting.Cfg, pluginStore plugins.Store) *PluginsService {
	return &PluginsService{
		enabled:          cfg.CheckForUpdates,
		grafanaVersion:   cfg.BuildVersion,
		httpClient:       http.Client{Timeout: 10 * time.Second},
		log:              log.New("plugins.update.checker"),
		pluginStore:      pluginStore,
		availableUpdates: make(map[string]PluginUpdate),
	}
}

func (s *PluginsService) IsDisabled() bool {
	return !s.enabled
}

func (s *PluginsService) Run(ctx context.Context) error {
	s.checkForUpdates(ctx)

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			s.checkForUpdates(ctx)
		case <-ctx.Done():
			run = false
		}
	}

	return ctx.Err()
}

func (s *PluginsService) HasUpdate(_ context.Context, pluginID string) (PluginUpdate, bool) {
	val, exists := s.availableUpdates[pluginID]
	if exists {
		return val, true
	}

	return PluginUpdate{}, false
}

func (s *PluginsService) checkForUpdates(ctx context.Context) {
	s.log.Debug("Checking for updates")

	localPlugins := s.pluginsEligibleForVersionCheck(ctx)
	resp, err := s.httpClient.Get("https://grafana.com/api/plugins/versioncheck?slugIn=" +
		s.pluginIDsCSV(localPlugins) + "&grafanaVersion=" + s.grafanaVersion)
	if err != nil {
		s.log.Debug("Failed to get plugins repo from grafana.com", "error", err.Error())
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		s.log.Debug("Update check failed, reading response from grafana.com", "error", err.Error())
		return
	}

	type gcomPlugin struct {
		Slug    string `json:"slug"`
		Version string `json:"version"`
	}
	var gcomPlugins []gcomPlugin
	err = json.Unmarshal(body, &gcomPlugins)
	if err != nil {
		s.log.Debug("Failed to unmarshal plugin repo, reading response from grafana.com", "error", err.Error())
		return
	}

	for _, localP := range localPlugins {
		for _, gcomP := range gcomPlugins {
			if gcomP.Slug == localP.ID {
				plugVersion, err1 := version.NewVersion(localP.Info.Version)
				gplugVersion, err2 := version.NewVersion(gcomP.Version)

				var updateDetails PluginUpdate
				if err1 != nil || err2 != nil {
					updateDetails = PluginUpdate{
						GcomVersion: gcomP.Version,
						HasUpdate:   localP.Info.Version != gcomP.Version,
					}
				} else {
					updateDetails = PluginUpdate{
						GcomVersion: gcomP.Version,
						HasUpdate:   plugVersion.LessThan(gplugVersion),
					}
				}
				s.availableUpdates[localP.ID] = updateDetails
			}
		}
	}
}

func (s *PluginsService) pluginIDsCSV(list []plugins.PluginDTO) string {
	var ids []string
	for _, p := range list {
		ids = append(ids, p.ID)
	}

	return strings.Join(ids, ",")
}

func (s *PluginsService) pluginsEligibleForVersionCheck(ctx context.Context) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	for _, p := range s.pluginStore.Plugins(ctx) {
		if p.IsCorePlugin() {
			continue
		}

		result = append(result, p)
	}

	return result
}
