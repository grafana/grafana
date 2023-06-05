package services

import (
	"bufio"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"runtime"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

type GrafanaComClient struct {
	retryCount int
}

func (client *GrafanaComClient) GetPlugin(pluginId, repoUrl string) (models.Plugin, error) {
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

func (client *GrafanaComClient) DownloadFile(pluginName string, tmpFile *os.File, url string, checksum string) (err error) {
	// Try handling URL as a local file path first
	if _, err := os.Stat(url); err == nil {
		// We can ignore this gosec G304 warning since `url` stems from command line flag "pluginUrl". If the
		// user shouldn't be able to read the file, it should be handled through filesystem permissions.
		// nolint:gosec
		f, err := os.Open(url)
		if err != nil {
			return fmt.Errorf("%v: %w", "Failed to read plugin archive", err)
		}
		_, err = io.Copy(tmpFile, f)
		if err != nil {
			return fmt.Errorf("%v: %w", "Failed to copy plugin archive", err)
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
					err = fmt.Errorf("corrupt HTTP response from source, please try again")
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
		return fmt.Errorf("%v: %w", "Failed to send request", err)
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			logger.Warn("Failed to close body", "err", err)
		}
	}()

	w := bufio.NewWriter(tmpFile)
	h := sha256.New()
	if _, err = io.Copy(w, io.TeeReader(bodyReader, h)); err != nil {
		return fmt.Errorf("%v: %w", "failed to compute SHA256 checksum", err)
	}
	if err := w.Flush(); err != nil {
		return fmt.Errorf("failed to write to %q: %w", tmpFile.Name(), err)
	}
	if len(checksum) > 0 && checksum != fmt.Sprintf("%x", h.Sum(nil)) {
		return fmt.Errorf("expected SHA256 checksum does not match the downloaded archive - please contact security@grafana.com")
	}
	return nil
}

func (client *GrafanaComClient) ListAllPlugins(repoUrl string) (models.PluginRepo, error) {
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
