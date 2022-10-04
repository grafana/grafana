package github

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/segmentio/encoding/json"
)

type GitHubAsset struct {
	Id          int64  `json:"id"`
	Name        string `json:"name"`
	DownloadUrl string `json:"browser_download_url"`
}

type GitHubRelease struct {
	Id        int64  `json:"id"`
	UploadUrl string `json:"upload_url"`
}

type GitHubCreateReleaseRequest struct {
	TagName string `json:"tag_name"`
}

const UploadContentType = "application/octet-stream"
const AcceptHeader = "application/vnd.github+json"
const ApiRoot = "https://api.github.com"

func GetReleaseByTag(token string, repo string, tag string) (*GitHubRelease, error) {
	path := fmt.Sprintf("%s/repos/%s/releases/tags/%s", ApiRoot, repo, tag)
	headers := getDefaultHeaders(token)
	body, err := sendRequest(http.MethodGet, path, headers, nil)
	if err != nil {
		return nil, err
	}

	release := &GitHubRelease{}
	err = json.Unmarshal(body, release)
	if err != nil {
		return nil, err
	}

	return release, nil
}

func CreateReleaseByTag(token string, repo string, tag string) (*GitHubRelease, error) {
	path := fmt.Sprintf("%s/repos/%s/releases", ApiRoot, repo)
	headers := getDefaultHeaders(token)
	reqBody, err := json.Marshal(GitHubCreateReleaseRequest{TagName: tag})
	if err != nil {
		return nil, err
	}

	resBody, err := sendRequest(http.MethodPost, path, headers, reqBody)
	if err != nil {
		return nil, err
	}

	release := &GitHubRelease{}
	err = json.Unmarshal(resBody, release)
	if err != nil {
		return nil, err
	}

	return release, nil
}

func UploadAsset(token string, release *GitHubRelease, filePath string) (*GitHubAsset, error) {
	path := strings.Split(release.UploadUrl, "{?")[0]
	assetName := filepath.Base(filePath)
	pathWithName := fmt.Sprintf("%s?name=%s", path, assetName)

	headers := getDefaultHeaders(token)
	headers["Content-Type"] = UploadContentType

	reqBody, err := os.ReadFile(filepath.Clean(filePath))
	if err != nil {
		return nil, err
	}

	resBody, err := sendRequest(http.MethodPost, pathWithName, headers, reqBody)
	if err != nil {
		return nil, err
	}

	asset := &GitHubAsset{}
	err = json.Unmarshal(resBody, asset)
	if err != nil {
		return nil, err
	}

	return asset, nil
}

func getDefaultHeaders(token string) map[string]string {
	headers := make(map[string]string)
	headers["Accept"] = AcceptHeader
	headers["Authorization"] = fmt.Sprintf("token %s", token)
	return headers
}

func sendRequest(method string, path string, headers map[string]string, body []byte) ([]byte, error) {
	req, err := http.NewRequest(method, path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Add(k, v)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	body, err = io.ReadAll(res.Body)
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("failed to close response body", "err", err)
		}
	}()
	return body, err
}
