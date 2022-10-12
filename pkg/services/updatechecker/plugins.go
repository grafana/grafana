package updatechecker

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/go-version"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginsService struct {
	availableUpdates map[string]string

	enabled        bool
	grafanaVersion string
	pluginStore    plugins.Store
	httpClient     httpClient
	mutex          sync.RWMutex
	log            log.Logger
}

func ProvidePluginsService(cfg *setting.Cfg, pluginStore plugins.Store) *PluginsService {
	return &PluginsService{
		enabled:          cfg.CheckForPluginUpdates,
		grafanaVersion:   cfg.BuildVersion,
		httpClient:       &http.Client{Timeout: 10 * time.Second},
		log:              log.New("plugins.update.checker"),
		pluginStore:      pluginStore,
		availableUpdates: make(map[string]string),
	}
}

type httpClient interface {
	Get(url string) (resp *http.Response, err error)
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

func (s *PluginsService) HasUpdate(ctx context.Context, pluginID string) (string, bool) {
	s.mutex.RLock()
	updateVers, updateAvailable := s.availableUpdates[pluginID]
	s.mutex.RUnlock()
	if updateAvailable {
		// check if plugin has already been updated since the last invocation of `checkForUpdates`
		plugin, exists := s.pluginStore.Plugin(ctx, pluginID)
		if !exists {
			return "", false
		}

		if canUpdate(plugin.Info.Version, updateVers) {
			return updateVers, true
		}
	}

	return "", false
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

	body, err := io.ReadAll(resp.Body)
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

	availableUpdates := map[string]string{}
	for _, gcomP := range gcomPlugins {
		if localP, exists := localPlugins[gcomP.Slug]; exists {
			if canUpdate(localP.Info.Version, gcomP.Version) {
				availableUpdates[localP.ID] = gcomP.Version
			}
		}
	}

	if len(availableUpdates) > 0 {
		s.mutex.Lock()
		s.availableUpdates = availableUpdates
		s.mutex.Unlock()
	}
}

func canUpdate(v1, v2 string) bool {
	ver1, err1 := version.NewVersion(v1)
	if err1 != nil {
		return false
	}
	ver2, err2 := version.NewVersion(v2)
	if err2 != nil {
		return false
	}

	return ver1.LessThan(ver2)
}

func (s *PluginsService) pluginIDsCSV(m map[string]plugins.PluginDTO) string {
	var ids []string
	for pluginID := range m {
		ids = append(ids, pluginID)
	}

	return strings.Join(ids, ",")
}

func (s *PluginsService) pluginsEligibleForVersionCheck(ctx context.Context) map[string]plugins.PluginDTO {
	result := make(map[string]plugins.PluginDTO)
	for _, p := range s.pluginStore.Plugins(ctx) {
		if p.IsCorePlugin() {
			continue
		}
		result[p.ID] = p
	}

	return result
}
