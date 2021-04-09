package manager

import (
	"errors"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Finder struct {
	Cfg *setting.Cfg `inject:""`
	log log.Logger

	found []string
}

func init() {
	registry.Register(&registry.Descriptor{
		Name: "PluginFinder",
		Instance: &Finder{
			log:   log.New("plugin.finder"),
			found: []string{},
		},
		InitPriority: registry.MediumHigh,
	})
}

func (f *Finder) Init() error {
	return nil
}

func (f *Finder) Find(pluginsPath string) ([]string, error) {
	exists, err := fs.Exists(pluginsPath)
	if err != nil {
		return nil, err
	}

	if !exists {
		if err = os.MkdirAll(pluginsPath, os.ModePerm); err != nil {
			f.log.Error("Failed to create external plugins directory", "dir", pluginsPath, "error", err)
		} else {
			f.log.Info("External plugins directory created", "directory", pluginsPath)
		}
	} else {
		if err := util.Walk(pluginsPath, true, true, f.walker); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				f.log.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", pluginsPath, "err", err)
				return nil, err
			}
			if errors.Is(err, os.ErrPermission) {
				f.log.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", pluginsPath, "err", err)
				return nil, err
			}
			if pluginsPath != "data/plugins" {
				f.log.Warn("Could not scan dir", "pluginDir", pluginsPath, "err", err)
			}
			return nil, err
		}
	}

	for _, settings := range f.Cfg.PluginSettings {
		path, exists := settings["path"]
		if !exists || path == "" {
			continue
		}
		if err := util.Walk(pluginsPath, true, true, f.walker); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				f.log.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", pluginsPath, "err", err)
				return nil, err
			}
			if errors.Is(err, os.ErrPermission) {
				f.log.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", pluginsPath, "err", err)
				return nil, err
			}
			if pluginsPath != "data/plugins" {
				f.log.Warn("Could not scan dir", "pluginDir", pluginsPath, "err", err)
			}
			return nil, err
		}
	}

	return f.found, nil
}

func (f *Finder) walker(currentPath string, fi os.FileInfo, err error) error {
	// We scan all the sub-folders for plugin.json (with some exceptions) so that we also load embedded plugins, for
	// example https://github.com/raintank/worldping-app/tree/master/dist/grafana-worldmap-panel worldmap panel plugin
	// is embedded in worldping app.
	if err != nil {
		return fmt.Errorf("filepath.Walk reported an error for %q: %w", currentPath, err)
	}

	if fi.Name() == "node_modules" || fi.Name() == "Chromium.app" {
		return util.ErrWalkSkipDir
	}

	if fi.IsDir() {
		return nil
	}

	if fi.Name() != "plugin.json" {
		return nil
	}

	f.found = append(f.found, currentPath)

	return nil
}
