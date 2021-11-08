package manager

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/hashicorp/go-version"
)

var (
	httpClient = http.Client{Timeout: 10 * time.Second}
)

type gcomPlugin struct {
	Slug    string `json:"slug"`
	Version string `json:"version"`
}

func (m *PluginManager) checkForUpdates() {
	if !m.cfg.CheckForUpdates {
		return
	}

	m.log.Debug("Checking for updates")

	pluginSlugs := m.externalPluginIDsAsCSV()
	resp, err := httpClient.Get("https://grafana.com/api/plugins/versioncheck?slugIn=" + pluginSlugs + "&grafanaVersion=" + m.cfg.BuildVersion)
	if err != nil {
		m.log.Debug("Failed to get plugins repo from grafana.com", "error", err.Error())
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			m.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		m.log.Debug("Update check failed, reading response from grafana.com", "error", err.Error())
		return
	}

	var gcomPlugins []gcomPlugin
	err = json.Unmarshal(body, &gcomPlugins)
	if err != nil {
		m.log.Debug("Failed to unmarshal plugin repo, reading response from grafana.com", "error", err.Error())
		return
	}

	for _, localP := range m.Plugins() {
		for _, gcomP := range gcomPlugins {
			if gcomP.Slug == localP.ID {
				localP.GrafanaComVersion = gcomP.Version

				plugVersion, err1 := version.NewVersion(localP.Info.Version)
				gplugVersion, err2 := version.NewVersion(gcomP.Version)

				if err1 != nil || err2 != nil {
					localP.GrafanaComHasUpdate = localP.Info.Version != localP.GrafanaComVersion
				} else {
					localP.GrafanaComHasUpdate = plugVersion.LessThan(gplugVersion)
				}
			}
		}
	}
}

func (m *PluginManager) externalPluginIDsAsCSV() string {
	var result []string
	for _, p := range m.plugins {
		if p.IsCorePlugin() {
			continue
		}

		result = append(result, p.ID)
	}

	return strings.Join(result, ",")
}
