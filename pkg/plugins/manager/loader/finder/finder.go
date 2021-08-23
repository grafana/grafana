package finder

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("plugin.finder")

type Finder struct {
	cfg *setting.Cfg
}

func New(cfg *setting.Cfg) Finder {
	return Finder{cfg: cfg}
}

func (f *Finder) Find(pluginsDir string) ([]string, error) {
	exists, err := fs.Exists(pluginsDir)
	if err != nil {
		return nil, err
	}

	var pluginJSONPaths []string
	if !exists && pluginsDir == f.cfg.PluginsPath { // if is external only create
		if err = os.MkdirAll(pluginsDir, os.ModePerm); err != nil {
			logger.Error("Failed to create external plugins directory", "dir", pluginsDir, "error", err)
		} else {
			logger.Info("External plugins directory created", "directory", pluginsDir)
		}
	} else {
		pluginJSONPaths, err = f.getPluginJSONPaths(pluginsDir)
		if err != nil {
			return nil, err
		}
	}

	var pluginSettingJSONPaths []string
	for _, settings := range f.cfg.PluginSettings {
		path, exists := settings["path"]
		if !exists || path == "" {
			continue
		}
		pluginJSONPaths, err := f.getPluginJSONPaths(path)
		if err != nil {
			return nil, err
		}
		pluginSettingJSONPaths = append(pluginSettingJSONPaths, pluginJSONPaths...)
	}

	return append(pluginJSONPaths, pluginSettingJSONPaths...), nil
}

func (f *Finder) getPluginJSONPaths(rootDirPath string) ([]string, error) {
	var pluginJSONPaths []string

	var err error
	rootDirPath, err = filepath.Abs(rootDirPath)
	if err != nil {
		return []string{}, err
	}

	if err := util.Walk(rootDirPath, true, true,
		func(currentPath string, fi os.FileInfo, err error) error {
			// We scan all the sub-folders for plugin.json (with some exceptions) so that we also load embedded plugins, for
			// example https://github.com/raintank/worldping-app/tree/master/dist/grafana-worldmap-panel worldmap panel plugin
			// is embedded in worldping app.
			if err != nil {
				return fmt.Errorf("filepath.Walk reported an error for %q: %w", currentPath, err)
			}

			if fi.Name() == "node_modules" {
				return util.ErrWalkSkipDir
			}

			if fi.IsDir() {
				return nil
			}

			if fi.Name() != "plugin.json" {
				return nil
			}

			pluginJSONPaths = append(pluginJSONPaths, currentPath)
			return nil
		}); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			logger.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", rootDirPath, "err", err)
			return []string{}, err
		}
		if errors.Is(err, os.ErrPermission) {
			logger.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", rootDirPath, "err", err)
			return []string{}, err
		}
		if rootDirPath != "data/plugins" {
			logger.Warn("Could not scan dir", "pluginDir", rootDirPath, "err", err)
		}

		return []string{}, err
	}

	return pluginJSONPaths, nil
}
