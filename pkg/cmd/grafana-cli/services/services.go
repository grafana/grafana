package services

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

var (
	IoHelper            m.IoUtil = IoUtilImp{}
	HttpClient          http.Client
	HttpClientNoTimeout http.Client
	grafanaVersion      string
	ErrNotFoundError    = errors.New("404 not found error")
)

type BadRequestError struct {
	Message string
	Status  string
}

func (e *BadRequestError) Error() string {
	if len(e.Message) > 0 {
		return fmt.Sprintf("%s: %s", e.Status, e.Message)
	}
	return e.Status
}

func Init(version string, skipTLSVerify bool) {
	grafanaVersion = version

	HttpClient = makeHttpClient(skipTLSVerify, 10*time.Second)
	HttpClientNoTimeout = makeHttpClient(skipTLSVerify, 0)
}

func makeHttpClient(skipTLSVerify bool, timeout time.Duration) http.Client {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: skipTLSVerify,
		},
	}

	return http.Client{
		Timeout:   timeout,
		Transport: tr,
	}
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
