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

type GrafanaNetPlugins struct {
	Plugins []GrafanaNetPlugin `json:"plugins"`
}

type GrafanaNetPlugin struct {
	Id       string                    `json:"id"`
	Versions []GrafanaNetPluginVersion `json:"versions"`
}

type GrafanaNetPluginVersion struct {
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

	ticker := time.NewTicker(time.Second * 24)
	for {
		select {
		case <-ticker.C:
			checkForUpdates()
		}
	}
}

func checkForUpdates() {
	log.Trace("Checking for updates")

	client := http.Client{Timeout: time.Duration(5 * time.Second)}
	resp, err := client.Get("https://grafana.net/api/plugins/repo")

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

	var data GrafanaNetPlugins
	err = json.Unmarshal(body, &data)
	if err != nil {
		log.Trace("Failed to unmarshal plugin repo, reading response from grafana.net, %v", err.Error())
		return
	}

	for _, plug := range Plugins {
		for _, gplug := range data.Plugins {
			if gplug.Id == plug.Id {
				if len(gplug.Versions) > 0 {
					plug.GrafanaNetVersion = gplug.Versions[0].Version
					plug.GrafanaNetHasUpdate = plug.Info.Version != plug.GrafanaNetVersion
				}
			}
		}
	}

	resp2, err := client.Get("https://raw.githubusercontent.com/grafana/grafana/master/latest.json")
	if err != nil {
		log.Trace("Failed to get lates.json repo from github: %v", err.Error())
		return
	}

	defer resp2.Body.Close()
	body, err = ioutil.ReadAll(resp2.Body)
	if err != nil {
		log.Trace("Update check failed, reading response from github.net, %v", err.Error())
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
		GrafanaHasUpdate = githubLatest.Testing != setting.BuildVersion
	} else {
		GrafanaLatestVersion = githubLatest.Stable
		GrafanaHasUpdate = githubLatest.Stable != setting.BuildVersion
	}
}
