package finder

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
)

type Remote struct {
	log log.Logger
}

func NewRemote() Remote {
	return Remote{log: log.New("remote.finder")}
}

func (r *Remote) Find(pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	jds := make(map[url.URL]*plugins.FoundBundle)
	for _, p := range pluginPaths {
		baseURL, err := url.ParseRequestURI(p)
		if err != nil {
			r.log.Warn("Invalid URL. Skipping plugin path", "path", p, "err", err)
			continue
		}

		if !strings.HasPrefix(baseURL.Scheme, "http") {
			r.log.Warn("Invalid URL. Skipping plugin path", "path", p, "err", err)
			continue
		}

		if !strings.HasSuffix(baseURL.String(), "/") {
			baseURL.Path = fmt.Sprintf("%s/", baseURL.Path)
		}

		if strings.HasPrefix(baseURL.Scheme, "http") {
			jd, err := getJSONData(fmt.Sprintf("%s/%s", baseURL.String(), "plugin.json"))
			if err != nil {
				r.log.Warn("Error occurred when fetching plugin.json data", "path", p)
				continue
			}

			m, mBytes, err := getSignature(baseURL.String())
			if err != nil {
				r.log.Warn("Error occurred when fetching MANIFEST.txt data", "path", p)
				continue
			}

			jds[*baseURL] = &plugins.FoundBundle{
				Primary: plugins.FoundPlugin{
					JSONData: jd,
					FS:       plugins.NewRemoteFS(baseURL, m.Files, mBytes),
				},
			}
		}
	}

	for baseURL, b := range jds {
		for _, f := range b.Primary.FS.Files() {
			if strings.Contains(f, "/plugin.json") { // TODO add better check for nested plugin.json
				jd, err := getJSONData(fmt.Sprintf("%s/%s", baseURL.String(), f))
				if err != nil {
					r.log.Warn("Error occurred when fetching plugin.json data for child", "path", f)
					continue
				}

				childRootDir := filepath.Dir(f)
				childFiles := make(map[string]string)
				for _, parentF := range b.Primary.FS.Files() {
					rp, err := filepath.Rel(childRootDir, parentF)
					if err != nil {
						r.log.Warn("Error occurred when fetching plugin.json data for child", "path", f)
						continue
					}

					if !strings.Contains(rp, "..") {
						childFiles[rp] = "" // TODO get hash
					}
				}

				childBaseURL := baseURL
				childBaseURL.Path = path.Join(childBaseURL.Path, childRootDir)
				b.Children = append(b.Children, &plugins.FoundPlugin{
					JSONData: jd,
					FS:       plugins.NewRemoteFS(&childBaseURL, childFiles, []byte{}),
				})
			}
		}
	}

	var res []*plugins.FoundBundle
	for _, b := range jds {
		res = append(res, b)
	}

	return res, nil
}

func getJSONData(path string) (plugins.JSONData, error) {
	resp, err := http.Get(path)
	if err != nil || resp.StatusCode/100 != 2 {
		return plugins.JSONData{}, fmt.Errorf("error occurred when checking for plugin.json")
	}

	var jd plugins.JSONData
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return plugins.JSONData{}, fmt.Errorf("error occurred when reading response body")

	}
	err = json.Unmarshal(body, &jd)
	if err != nil {
		return plugins.JSONData{}, fmt.Errorf("error occurred when unmarshalling")
	}

	err = resp.Body.Close()
	if err != nil {
		return plugins.JSONData{}, fmt.Errorf("error occurred when closing response body")
	}

	return jd, nil
}

func getSignature(path string) (signature.PluginManifest, []byte, error) {
	resp, err := http.Get(fmt.Sprintf("%s/%s", path, "MANIFEST.txt"))
	if err != nil || resp.StatusCode/100 != 2 {
		return signature.PluginManifest{}, []byte{}, fmt.Errorf("error occurred when checking for MANIFEST.txt")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return signature.PluginManifest{}, []byte{}, fmt.Errorf("error occurred when reading response body")

	}

	m, err := signature.ReadPluginManifest(body)
	if err != nil {
		return signature.PluginManifest{}, []byte{}, fmt.Errorf("error occurred when unmarshalling")

	}

	err = resp.Body.Close()
	if err != nil {
		return signature.PluginManifest{}, []byte{}, fmt.Errorf("error occurred when closing response body")
	}

	return *m, body, nil
}
