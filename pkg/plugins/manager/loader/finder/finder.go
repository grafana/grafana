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

func (f *Finder) Find(pluginDirs []string) ([]string, error) { //io.fs
	var pluginJSONPaths []string

	for _, dir := range pluginDirs {
		exists, err := fs.Exists(dir)
		if err != nil {
			return nil, err
		}

		if !exists {
			if fs.NaiveEqual(f.cfg.PluginsPath, dir) {
				if err = os.MkdirAll(dir, os.ModePerm); err != nil {
					logger.Error("Failed to create external plugins directory", "dir", dir, "error", err)
				} else {
					logger.Info("External plugins directory created", "directory", dir)
				}
			} else {
				return nil, fmt.Errorf("aborting install as plugins directory %s does not exist", dir)
			}
		}
		paths, err := f.getPluginJSONPaths(dir)
		if err != nil {
			return nil, err
		}
		pluginJSONPaths = append(pluginJSONPaths, paths...)
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

func (f *Finder) getPluginJSONPaths(dir string) ([]string, error) {
	var pluginJSONPaths []string

	var err error
	dir, err = filepath.Abs(dir)
	if err != nil {
		return []string{}, err
	}

	if err := util.Walk(dir, true, true,
		func(currentPath string, fi os.FileInfo, err error) error {
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
			logger.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", dir, "err", err)
			return []string{}, err
		}
		if errors.Is(err, os.ErrPermission) {
			logger.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", dir, "err", err)
			return []string{}, err
		}
		if dir != "data/plugins" {
			logger.Warn("Could not scan dir", "pluginDir", dir, "err", err)
		}

		return []string{}, err
	}

	return pluginJSONPaths, nil
}
