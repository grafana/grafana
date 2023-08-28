package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"runtime"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

func GetPluginInfoFromRepo(pluginId, repoUrl string) (models.Plugin, error) {
	logger.Debugf("getting plugin metadata from: %v pluginId: %v \n", repoUrl, pluginId)
	body, err := sendRequestGetBytes(HttpClient, repoUrl, "repo", pluginId)
	if err != nil {
		if errors.Is(err, ErrNotFoundError) {
			return models.Plugin{}, fmt.Errorf("%v: %w",
				fmt.Sprintf("Failed to find requested plugin, check if the plugin_id (%s) is correct", pluginId), err)
		}
		return models.Plugin{}, fmt.Errorf("%v: %w", "Failed to send request", err)
	}

	var data models.Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Info("Failed to unmarshal plugin repo response error:", err)
		return models.Plugin{}, err
	}

	return data, nil
}

func ListAllPlugins(repoUrl string) (models.PluginRepo, error) {
	body, err := sendRequestGetBytes(HttpClient, repoUrl, "repo")

	if err != nil {
		logger.Info("Failed to send request", "error", err)
		return models.PluginRepo{}, fmt.Errorf("%v: %w", "Failed to send request", err)
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
	defer func() {
		if err := bodyReader.Close(); err != nil {
			logger.Warn("Failed to close stream", "err", err)
		}
	}()
	return io.ReadAll(bodyReader)
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
	u, err := url.Parse(repoUrl)
	if err != nil {
		return nil, err
	}

	for _, v := range subPaths {
		u.Path = path.Join(u.Path, v)
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("grafana-version", GrafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+GrafanaVersion)

	return req, err
}

func handleResponse(res *http.Response) (io.ReadCloser, error) {
	if res.StatusCode == 404 {
		return nil, ErrNotFoundError
	}

	if res.StatusCode/100 != 2 && res.StatusCode/100 != 4 {
		return nil, fmt.Errorf("API returned invalid status: %s", res.Status)
	}

	if res.StatusCode/100 == 4 {
		body, err := io.ReadAll(res.Body)
		defer func() {
			if err := res.Body.Close(); err != nil {
				logger.Warn("Failed to close response body", "err", err)
			}
		}()
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
