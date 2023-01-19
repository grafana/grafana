package finder

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/org"
)

type HTTP struct {
	log log.Logger
}

func NewRemote() *HTTP {
	return &HTTP{log: log.New("plugin.remote.finder")}
}

var skipErr = errors.New("skip")

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
			if errors.Is(err, skipErr) {
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

	var children map[string]*plugins.FoundPlugin
	for key, data := range foundPlugins {
		for _, plugin := range data.Dependencies.Plugins {
			jd, err := h.fetchPlugin(plugin.ID) // get plugin CDN path given plugin ID + version
			if err != nil {
				if errors.Is(err, skipErr) {
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
		return plugins.JSONData{}, skipErr
	}

	path, err = url.JoinPath(path, "plugin.json")
	if err != nil {
		h.log.Warn("Skipping finding plugins as path is invalid URL", "path", path)
		return plugins.JSONData{}, skipErr
	}

	resp, err := http.Get(path)
	if err != nil || resp.StatusCode/100 != 2 {
		h.log.Warn("Error occurred when fetching plugin.json", "path", path, "err", err)
		return plugins.JSONData{}, skipErr

	}

	var jd plugins.JSONData
	body, err := io.ReadAll(resp.Body)
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

func (h *HTTP) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	h.log.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return plugins.JSONData{}, ErrInvalidPluginJSONFilePath
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `currentPath` is based
	// on plugin the folder structure on disk and not user input.
	reader, err := os.Open(pluginJSONPath)
	if err != nil {
		return plugins.JSONData{}, err
	}

	plugin := plugins.JSONData{}
	if err = json.NewDecoder(reader).Decode(&plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if err = reader.Close(); err != nil {
		h.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if err = validatePluginJSON(plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if plugin.ID == "grafana-piechart-panel" {
		plugin.Name = "Pie Chart (old)"
	}

	if len(plugin.Dependencies.Plugins) == 0 {
		plugin.Dependencies.Plugins = []plugins.Dependency{}
	}

	if plugin.Dependencies.GrafanaVersion == "" {
		plugin.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range plugin.Includes {
		if include.Role == "" {
			include.Role = org.RoleViewer
		}
	}

	return plugin, nil
}
