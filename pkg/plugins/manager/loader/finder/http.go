package finder

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

type HTTP struct {
	log log.Logger
}

func newRemote() *HTTP {
	return &HTTP{log: log.New("plugin.remote.finder")}
}

var errSkipPlugin = errors.New("skip plugin")

func (h *HTTP) Find(_ context.Context, pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	type pluginKey struct {
		path    string
		id      string
		version string
	}

	foundPlugins := make(map[pluginKey]plugins.JSONData)
	for _, path := range pluginPaths {
		if !strings.HasPrefix(path, "http") {
			continue
		}

		jd, err := h.fetchPlugin(path)
		if err != nil {
			if errors.Is(err, errSkipPlugin) {
				continue
			}
			return nil, err
		}

		foundPlugins[pluginKey{
			id:      jd.ID,
			version: jd.Info.Version,
			path:    path,
		}] = jd
	}

	children := make(map[string]*plugins.FoundPlugin)
	for key, data := range foundPlugins {
		for _, plugin := range data.Dependencies.Plugins {
			jd, err := h.fetchPlugin(plugin.ID) // get plugin CDN path given plugin ID + version
			if err != nil {
				if errors.Is(err, errSkipPlugin) {
					continue
				}
				return nil, err
			}

			children[key.id] = &plugins.FoundPlugin{
				JSONData: jd,
				FS:       plugins.NewRemoteFS(key.path),
			}
		}
	}

	var res []*plugins.FoundBundle
	for key, jd := range foundPlugins {
		primary := plugins.FoundPlugin{
			JSONData: jd,
			FS:       plugins.NewRemoteFS(key.path),
		}

		var cs []*plugins.FoundPlugin
		if child, exists := children[key.id]; exists {
			cs = append(cs, child)
		}

		res = append(res, &plugins.FoundBundle{
			Primary:  primary,
			Children: cs,
		})
	}

	return res, nil
}

func (h *HTTP) fetchPlugin(path string) (plugins.JSONData, error) {
	_, err := url.Parse(path)
	if err != nil {
		h.log.Warn("Skipping finding plugins as path is invalid URL", "path", path)
		return plugins.JSONData{}, errSkipPlugin
	}

	u, err := url.JoinPath(path, "plugin.json")
	if err != nil {
		h.log.Warn("Skipping finding plugins as path is invalid URL", "path", path)
		return plugins.JSONData{}, errSkipPlugin
	}

	// It's safe to ignore gosec warning G107 since the path comes from the Grafana configuration and is also
	// suffixed above with "plugin.json"
	// nolint:gosec
	resp, err := http.Get(u)
	if err != nil {
		h.log.Warn("Error occurred when fetching plugin.json", "path", path, "err", err)
		return plugins.JSONData{}, errSkipPlugin
	}

	if resp.StatusCode/100 == http.StatusNotFound {
		h.log.Warn("Could not find plugin.json", "path", path)
		return plugins.JSONData{}, fmt.Errorf("could not find plugin.json at %s", path)
	}

	var jd plugins.JSONData
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.log.Warn("Error occurred when reading response body", "path", path, "err", err)
		return plugins.JSONData{}, errSkipPlugin
	}
	err = json.Unmarshal(body, &jd)
	if err != nil {
		h.log.Warn("Error occurred when unmarshalling plugin.json", "path", path, "err", err)
		return plugins.JSONData{}, err
	}

	err = resp.Body.Close()
	if err != nil {
		h.log.Warn("Error occurred when closing response body", "path", path, "err", err)
		return plugins.JSONData{}, err
	}

	return jd, nil
}
