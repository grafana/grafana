package services

import (
	"bufio"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
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
	body, err := sendRequestGetBytes(HttpClient, repoUrl, "repo", pluginId)

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

func (client *GrafanaComClient) DownloadFile(pluginName string, tmpFile *os.File, url string, checksum string) (err error) {
	// Try handling url like local file path first
	if _, err := os.Stat(url); err == nil {
		f, err := os.Open(url)
		if err != nil {
			return errutil.Wrap("Failed to read plugin archive", err)
		}
		_, err = io.Copy(tmpFile, f)
		if err != nil {
			return errutil.Wrap("Failed to copy plugin archive", err)
		}
		return nil
	}

	client.retryCount = 0

	defer func() {
		if r := recover(); r != nil {
			client.retryCount++
			if client.retryCount < 3 {
				logger.Info("Failed downloading. Will retry once.")
				err = tmpFile.Truncate(0)
				if err != nil {
					return
				}
				_, err = tmpFile.Seek(0, 0)
				if err != nil {
					return
				}
				err = client.DownloadFile(pluginName, tmpFile, url, checksum)
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

	// Using no timeout here as some plugins can be bigger and smaller timeout would prevent to download a plugin on
	// slow network. As this is CLI operation hanging is not a big of an issue as user can just abort.
	bodyReader, err := sendRequest(HttpClientNoTimeout, url)
	if err != nil {
		return errutil.Wrap("Failed to send request", err)
	}
	defer bodyReader.Close()

	w := bufio.NewWriter(tmpFile)
	h := md5.New()
	if _, err = io.Copy(w, io.TeeReader(bodyReader, h)); err != nil {
		return errutil.Wrap("Failed to compute MD5 checksum", err)
	}
	w.Flush()
	if len(checksum) > 0 && checksum != fmt.Sprintf("%x", h.Sum(nil)) {
		return xerrors.New("Expected MD5 checksum does not match the downloaded archive. Please contact security@grafana.com.")
	}
	return nil
}

func (client *GrafanaComClient) ListAllPlugins(repoUrl string) (models.PluginRepo, error) {
	body, err := sendRequestGetBytes(HttpClient, repoUrl, "repo")

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

func sendRequestGetBytes(client http.Client, repoUrl string, subPaths ...string) ([]byte, error) {
	bodyReader, err := sendRequest(client, repoUrl, subPaths...)
	if err != nil {
		return []byte{}, err
	}
	defer bodyReader.Close()
	return ioutil.ReadAll(bodyReader)
}

func sendRequest(client http.Client, repoUrl string, subPaths ...string) (io.ReadCloser, error) {
	req, err := createRequest(repoUrl, subPaths...)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	return handleResponse(res)
}

func createRequest(repoUrl string, subPaths ...string) (*http.Request, error) {
	u, _ := url.Parse(repoUrl)
	for _, v := range subPaths {
		u.Path = path.Join(u.Path, v)
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("grafana-version", grafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+grafanaVersion)

	return req, err
}

func handleResponse(res *http.Response) (io.ReadCloser, error) {
	if res.StatusCode == 404 {
		return nil, ErrNotFoundError
	}

	if res.StatusCode/100 != 2 && res.StatusCode/100 != 4 {
		return nil, fmt.Errorf("Api returned invalid status: %s", res.Status)
	}

	if res.StatusCode/100 == 4 {
		body, err := ioutil.ReadAll(res.Body)
		defer res.Body.Close()
		if err != nil || len(body) == 0 {
			return nil, &BadRequestError{Status: res.Status}
		}
		var message string
		var jsonBody map[string]string
		err = json.Unmarshal(body, &jsonBody)
		if err != nil || len(jsonBody["message"]) == 0 {
			message = string(body)
		} else {
			message = jsonBody["message"]
		}
		return nil, &BadRequestError{Status: res.Status, Message: message}
	}

	return res.Body, nil
}
