package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"

	"github.com/franela/goreq"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

var IoHelper m.IoUtil = IoUtilImp{}

func ListAllPlugins(repoUrl string) (m.PluginRepo, error) {
	fullUrl := repoUrl + "/repo"
	res, err := goreq.Request{Uri: fullUrl, MaxRedirects: 3}.Do()
	if err != nil {
		return m.PluginRepo{}, err
	}
	if res.StatusCode != 200 {
		return m.PluginRepo{}, fmt.Errorf("Could not access %s statuscode %v", fullUrl, res.StatusCode)
	}

	var resp m.PluginRepo
	err = res.Body.FromJsonTo(&resp)
	if err != nil {
		return m.PluginRepo{}, errors.New("Could not load plugin data")
	}

	return resp, nil
}

func ReadPlugin(pluginDir, pluginName string) (m.InstalledPlugin, error) {
	pluginDataPath := path.Join(pluginDir, pluginName, "plugin.json")
	pluginData, _ := IoHelper.ReadFile(pluginDataPath)

	res := m.InstalledPlugin{}
	json.Unmarshal(pluginData, &res)

	if res.Info.Version == "" {
		res.Info.Version = "0.0.0"
	}

	if res.Id == "" {
		return m.InstalledPlugin{}, errors.New("could not read find plugin " + pluginName)
	}

	return res, nil
}

func GetLocalPlugins(pluginDir string) []m.InstalledPlugin {
	result := make([]m.InstalledPlugin, 0)
	files, _ := IoHelper.ReadDir(pluginDir)
	for _, f := range files {
		res, err := ReadPlugin(pluginDir, f.Name())
		if err == nil {
			result = append(result, res)
		}
	}

	return result
}

func RemoveInstalledPlugin(pluginPath, id string) error {
	log.Infof("Removing plugin: %v\n", id)
	return IoHelper.RemoveAll(path.Join(pluginPath, id))
}

func GetPlugin(pluginId, repoUrl string) (m.Plugin, error) {
	resp, _ := ListAllPlugins(repoUrl)

	for _, i := range resp.Plugins {
		if i.Id == pluginId {
			return i, nil
		}
	}

	return m.Plugin{}, errors.New("could not find plugin named \"" + pluginId + "\"")
}
