package manager

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/hashicorp/go-version"
)

var (
	httpClient = http.Client{Timeout: 10 * time.Second}
)

type grafanaNetPlugin struct {
	Slug    string `json:"slug"`
	Version string `json:"version"`
}

type gitHubLatest struct {
	Stable  string `json:"stable"`
	Testing string `json:"testing"`
}

func (pm *PluginManager) getAllExternalPluginSlugs() string {
	var result []string
	for _, plug := range pm.plugins {
		if plug.IsCorePlugin {
			continue
		}

		result = append(result, plug.Id)
	}

	return strings.Join(result, ",")
}

func (pm *PluginManager) checkForUpdates() {
	if !pm.Cfg.CheckForUpdates {
		return
	}

	pm.log.Debug("Checking for updates")

	pluginSlugs := pm.getAllExternalPluginSlugs()
	resp, err := httpClient.Get("https://grafana.com/api/plugins/versioncheck?slugIn=" + pluginSlugs + "&grafanaVersion=" + setting.BuildVersion)
	if err != nil {
		log.Debug("Failed to get plugins repo from grafana.com", "error", err.Error())
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Debug("Update check failed, reading response from grafana.com", "error", err.Error())
		return
	}

	gNetPlugins := []grafanaNetPlugin{}
	err = json.Unmarshal(body, &gNetPlugins)
	if err != nil {
		log.Debug("Failed to unmarshal plugin repo, reading response from grafana.com", "error", err.Error())
		return
	}

	for _, plug := range pm.Plugins() {
		for _, gplug := range gNetPlugins {
			if gplug.Slug == plug.Id {
				plug.GrafanaNetVersion = gplug.Version

				plugVersion, err1 := version.NewVersion(plug.Info.Version)
				gplugVersion, err2 := version.NewVersion(gplug.Version)

				if err1 != nil || err2 != nil {
					plug.GrafanaNetHasUpdate = plug.Info.Version != plug.GrafanaNetVersion
				} else {
					plug.GrafanaNetHasUpdate = plugVersion.LessThan(gplugVersion)
				}
			}
		}
	}

	resp2, err := httpClient.Get("https://raw.githubusercontent.com/grafana/grafana/main/latest.json")
	if err != nil {
		log.Debug("Failed to get latest.json repo from github.com", "error", err.Error())
		return
	}
	defer func() {
		if err := resp2.Body.Close(); err != nil {
			pm.log.Warn("Failed to close response body", "err", err)
		}
	}()
	body, err = ioutil.ReadAll(resp2.Body)
	if err != nil {
		log.Debug("Update check failed, reading response from github.com", "error", err.Error())
		return
	}

	var latest gitHubLatest
	err = json.Unmarshal(body, &latest)
	if err != nil {
		log.Debug("Failed to unmarshal github.com latest, reading response from github.com", "error", err.Error())
		return
	}

	if strings.Contains(setting.BuildVersion, "-") {
		pm.grafanaLatestVersion = latest.Testing
		pm.grafanaHasUpdate = !strings.HasPrefix(setting.BuildVersion, latest.Testing)
	} else {
		pm.grafanaLatestVersion = latest.Stable
		pm.grafanaHasUpdate = latest.Stable != setting.BuildVersion
	}

	currVersion, err1 := version.NewVersion(setting.BuildVersion)
	latestVersion, err2 := version.NewVersion(pm.grafanaLatestVersion)
	if err1 == nil && err2 == nil {
		pm.grafanaHasUpdate = currVersion.LessThan(latestVersion)
	}
}
