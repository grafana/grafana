package plugins

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

type GrafanaNetPlugin struct {
	Slug    string `json:"slug"`
	Version string `json:"version"`
}

type GithubLatest struct {
	Stable  string `json:"stable"`
	Testing string `json:"testing"`
}

func StartPluginUpdateChecker() {
	if !setting.CheckForUpdates {
		return
	}

	// do one check directly
	go checkForUpdates()

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			checkForUpdates()
		}
	}
}

func getAllExternalPluginSlugs() string {
	str := ""

	for _, plug := range Plugins {
		if plug.IsCorePlugin {
			continue
		}

		str += plug.Id + ","
	}

	return str
}

func checkForUpdates() {
	log.Trace("Checking for updates")

	client := http.Client{Timeout: time.Duration(5 * time.Second)}

	pluginSlugs := getAllExternalPluginSlugs()
	resp, err := client.Get("https://grafana.net/api/plugins/versioncheck?slugIn=" + pluginSlugs + "&grafanaVersion=" + setting.BuildVersion)

	if err != nil {
		log.Trace("Failed to get plugins repo from grafana.net, %v", err.Error())
		return
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Trace("Update check failed, reading response from grafana.net, %v", err.Error())
		return
	}

	gNetPlugins := []GrafanaNetPlugin{}
	err = json.Unmarshal(body, &gNetPlugins)
	if err != nil {
		log.Trace("Failed to unmarshal plugin repo, reading response from grafana.net, %v", err.Error())
		return
	}

	for _, plug := range Plugins {
		for _, gplug := range gNetPlugins {
			if gplug.Slug == plug.Id {
				plug.GrafanaNetVersion = gplug.Version
				plug.GrafanaNetHasUpdate = plug.Info.Version != plug.GrafanaNetVersion
			}
		}
	}

	resp2, err := client.Get("https://raw.githubusercontent.com/grafana/grafana/master/latest.json")
	if err != nil {
		log.Trace("Failed to get latest.json repo from github: %v", err.Error())
		return
	}

	defer resp2.Body.Close()
	body, err = ioutil.ReadAll(resp2.Body)
	if err != nil {
		log.Trace("Update check failed, reading response from github.com, %v", err.Error())
		return
	}

	var githubLatest GithubLatest
	err = json.Unmarshal(body, &githubLatest)
	if err != nil {
		log.Trace("Failed to unmarshal github latest, reading response from github: %v", err.Error())
		return
	}

	if strings.Contains(setting.BuildVersion, "-") {
		GrafanaLatestVersion = githubLatest.Testing
		GrafanaHasUpdate = !strings.HasPrefix(setting.BuildVersion, githubLatest.Testing)
	} else {
		GrafanaLatestVersion = githubLatest.Stable
		GrafanaHasUpdate = githubLatest.Stable != setting.BuildVersion
	}
}
