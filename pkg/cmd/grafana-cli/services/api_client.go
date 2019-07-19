package services

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path"
	"runtime"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/xerrors"
)

type GrafanaComClient struct {
	retryCount int
}

func (client *GrafanaComClient) GetPlugin(pluginId, repoUrl string) (models.Plugin, error) {
	logger.Debugf("getting plugin metadata from: %v pluginId: %v \n", repoUrl, pluginId)
	body, err := sendRequest(HttpClient, repoUrl, "repo", pluginId)

	if err != nil {
		if err == ErrNotFoundError {
			return models.Plugin{}, errutil.Wrap("Failed to find requested plugin, check if the plugin_id is correct", err)
		}
		return models.Plugin{}, errutil.Wrap("Failed to send request", err)
	}

	var data models.Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Info("Failed to unmarshal plugin repo response error:", err)
		return models.Plugin{}, err
	}

	return data, nil
}

func (client *GrafanaComClient) DownloadFile(pluginName, filePath, url string, checksum string) (content []byte, err error) {
	// Try handling url like local file path first
	if _, err := os.Stat(url); err == nil {
		bytes, err := ioutil.ReadFile(url)
		if err != nil {
			return nil, errutil.Wrap("Failed to read file", err)
		}
		return bytes, nil
	}

	client.retryCount = 0

	defer func() {
		if r := recover(); r != nil {
			client.retryCount++
			if client.retryCount < 3 {
				logger.Info("Failed downloading. Will retry once.")
				content, err = client.DownloadFile(pluginName, filePath, url, checksum)
			} else {
				client.retryCount = 0
				failure := fmt.Sprintf("%v", r)
				if failure == "runtime error: makeslice: len out of range" {
					err = xerrors.New("Corrupt http response from source. Please try again")
				} else {
					panic(r)
				}
			}
		}
	}()

	// TODO: this would be better if it was streamed file by file instead of buffered.
	// Using no timeout here as some plugins can be bigger and smaller timeout would prevent to download a plugin on
	// slow network. As this is CLI operation hanging is not a big of an issue as user can just abort.
	body, err := sendRequest(HttpClientNoTimeout, url)

	if err != nil {
		return nil, errutil.Wrap("Failed to send request", err)
	}

	if len(checksum) > 0 && checksum != fmt.Sprintf("%x", md5.Sum(body)) {
		return nil, xerrors.New("Expected MD5 checksum does not match the downloaded archive. Please contact security@grafana.com.")
	}
	return body, nil
}

func (client *GrafanaComClient) ListAllPlugins(repoUrl string) (models.PluginRepo, error) {
	body, err := sendRequest(HttpClient, repoUrl, "repo")

	if err != nil {
		logger.Info("Failed to send request", "error", err)
		return models.PluginRepo{}, errutil.Wrap("Failed to send request", err)
	}

	var data models.PluginRepo
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Info("Failed to unmarshal plugin repo response error:", err)
		return models.PluginRepo{}, err
	}

	return data, nil
}

func sendRequest(client http.Client, repoUrl string, subPaths ...string) ([]byte, error) {
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

	res, err := client.Do(req)
	if err != nil {
		return []byte{}, err
	}
	return handleResponse(res)
}

func handleResponse(res *http.Response) ([]byte, error) {
	if res.StatusCode == 404 {
		return []byte{}, ErrNotFoundError
	}

	if res.StatusCode/100 != 2 && res.StatusCode/100 != 4 {
		return []byte{}, fmt.Errorf("Api returned invalid status: %s", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()

	if res.StatusCode/100 == 4 {
		if len(body) == 0 {
			return []byte{}, &BadRequestError{Status: res.Status}
		}
		var message string
		var jsonBody map[string]string
		err = json.Unmarshal(body, &jsonBody)
		if err != nil || len(jsonBody["message"]) == 0 {
			message = string(body)
		} else {
			message = jsonBody["message"]
		}
		return []byte{}, &BadRequestError{Status: res.Status, Message: message}
	}

	return body, err
}
