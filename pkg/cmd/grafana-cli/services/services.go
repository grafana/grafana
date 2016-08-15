package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"

	"github.com/franela/goreq"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
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
	distPluginDataPath := path.Join(pluginDir, pluginName, "dist", "plugin.json")

	var data []byte
	var err error
	data, err = IoHelper.ReadFile(distPluginDataPath)

	if err != nil {
		pluginDataPath := path.Join(pluginDir, pluginName, "plugin.json")
		data, err = IoHelper.ReadFile(pluginDataPath)

		if err != nil {
			return m.InstalledPlugin{}, errors.New("Could not find dist/plugin.json or plugin.json on  " + pluginName + " in " + pluginDir)
		}
	}

	res := m.InstalledPlugin{}
	json.Unmarshal(data, &res)

	if res.Info.Version == "" {
		res.Info.Version = "0.0.0"
	}

	if res.Id == "" {
		return m.InstalledPlugin{}, errors.New("could not find plugin " + pluginName + " in " + pluginDir)
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

func RemoveInstalledPlugin(pluginPath, pluginName string) error {
	logger.Infof("Removing plugin: %v\n", pluginName)
	pluginDir := path.Join(pluginPath, pluginName)

	_, err := IoHelper.Stat(pluginDir)
	if err != nil {
		return err
	}

	return IoHelper.RemoveAll(pluginDir)
}

func GetPlugin(pluginId, repoUrl string) (m.Plugin, error) {
	fullUrl := repoUrl + "/repo/" + pluginId

	res, err := goreq.Request{Uri: fullUrl, MaxRedirects: 3}.Do()
	if err != nil {
		return m.Plugin{}, err
	}
	if res.StatusCode != 200 {
		return m.Plugin{}, fmt.Errorf("Could not access %s statuscode %v", fullUrl, res.StatusCode)
	}

	var resp m.Plugin
	err = res.Body.FromJsonTo(&resp)
	if err != nil {
		return m.Plugin{}, errors.New("Could not load plugin data")
	}

	return resp, nil
}
