package services

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"path"
	"runtime"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

var (
	IoHelper       m.IoUtil = IoUtilImp{}
	HttpClient     http.Client
	grafanaVersion string
	NotFoundError  = errors.New("404 not found error")
)

func Init(version string, skipTLSVerify bool) {
	grafanaVersion = version

	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: skipTLSVerify,
		},
	}

	HttpClient = http.Client{
		Timeout:   10 * time.Second,
		Transport: tr,
	}
}

func ListAllPlugins(repoUrl string) (m.PluginRepo, error) {
	body, err := sendRequest(repoUrl, "repo")

	if err != nil {
		logger.Info("Failed to send request", "error", err)
		return m.PluginRepo{}, fmt.Errorf("Failed to send request. error: %v", err)
	}

	if err != nil {
		return m.PluginRepo{}, err
	}

	var data m.PluginRepo
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Info("Failed to unmarshal plugin repo response error:", err)
		return m.PluginRepo{}, err
	}

	return data, nil
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
	logger.Debugf("getting plugin metadata from: %v pluginId: %v \n", repoUrl, pluginId)
	body, err := sendRequest(repoUrl, "repo", pluginId)

	if err != nil {
		logger.Info("Failed to send request: ", err)
		if err == NotFoundError {
			return m.Plugin{}, fmt.Errorf("Failed to find requested plugin, check if the plugin_id is correct. error: %v", err)
		}
		return m.Plugin{}, fmt.Errorf("Failed to send request. error: %v", err)
	}

	if err != nil {
		return m.Plugin{}, err
	}

	var data m.Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Info("Failed to unmarshal plugin repo response error:", err)
		return m.Plugin{}, err
	}

	return data, nil
}

func sendRequest(repoUrl string, subPaths ...string) ([]byte, error) {
	u, _ := url.Parse(repoUrl)
	for _, v := range subPaths {
		u.Path = path.Join(u.Path, v)
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)

	req.Header.Set("grafana-version", grafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+grafanaVersion)

	if err != nil {
		return []byte{}, err
	}

	res, err := HttpClient.Do(req)
	if err != nil {
		return []byte{}, err
	}

	if res.StatusCode == 404 {
		return []byte{}, NotFoundError
	}
	if res.StatusCode/100 != 2 {
		return []byte{}, fmt.Errorf("Api returned invalid status: %s", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()

	return body, err
}
