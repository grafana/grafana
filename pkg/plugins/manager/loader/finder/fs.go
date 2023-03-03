package finder

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

var walk = util.Walk

var (
	ErrInvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
	ErrInvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

type FS struct {
	log log.Logger
}

func newFS(logger log.Logger) *FS {
	return &FS{log: logger.New("fs")}
}

func (f *FS) Find(_ context.Context, pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	var pluginJSONPaths []string
	for _, path := range pluginPaths {
		exists, err := fs.Exists(path)
		if err != nil {
			f.log.Warn("Skipping finding plugins as an error occurred", "path", path, "err", err)
			continue
		}
		if !exists {
			f.log.Warn("Skipping finding plugins as directory does not exist", "path", path)
			continue
		}

		paths, err := f.getAbsPluginJSONPaths(path)
		if err != nil {
			return nil, err
		}
		pluginJSONPaths = append(pluginJSONPaths, paths...)
	}

	// load plugin.json files and map directory to JSON data
	foundPlugins := make(map[string]plugins.JSONData)
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := f.readPluginJSON(pluginJSONPath)
		if err != nil {
			f.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "err", err)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			f.log.Warn("Skipping plugin loading as absolute plugin.json path could not be calculated", "pluginID", plugin.ID, "err", err)
			continue
		}

		if _, dupe := foundPlugins[filepath.Dir(pluginJSONAbsPath)]; dupe {
			f.log.Warn("Skipping plugin loading as it's a duplicate", "pluginID", plugin.ID)
			continue
		}
		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	var res = make(map[string]*plugins.FoundBundle)
	for pluginDir, data := range foundPlugins {
		files, err := collectFilesWithin(pluginDir)
		if err != nil {
			return nil, err
		}

		res[pluginDir] = &plugins.FoundBundle{
			Primary: plugins.FoundPlugin{
				JSONData: data,
				FS:       plugins.NewLocalFS(files, pluginDir),
			},
		}
	}

	var result []*plugins.FoundBundle
	for dir := range foundPlugins {
		ancestors := strings.Split(dir, string(filepath.Separator))
		ancestors = ancestors[0 : len(ancestors)-1]

		pluginPath := ""
		if runtime.GOOS != "windows" && filepath.IsAbs(dir) {
			pluginPath = "/"
		}
		add := true
		for _, ancestor := range ancestors {
			pluginPath = filepath.Join(pluginPath, ancestor)
			if _, ok := foundPlugins[pluginPath]; ok {
				if fp, exists := res[pluginPath]; exists {
					fp.Children = append(fp.Children, &res[dir].Primary)
					add = false
					break
				}
			}
		}
		if add {
			result = append(result, res[dir])
		}
	}

	return result, nil
}

func (f *FS) getAbsPluginJSONPaths(path string) ([]string, error) {
	var pluginJSONPaths []string

	var err error
	path, err = filepath.Abs(path)
	if err != nil {
		return []string{}, err
	}

	if err = walk(path, true, true,
		func(currentPath string, fi os.FileInfo, err error) error {
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					f.log.Error("Couldn't scan directory since it doesn't exist", "pluginDir", path, "err", err)
					return nil
				}
				if errors.Is(err, os.ErrPermission) {
					f.log.Error("Couldn't scan directory due to lack of permissions", "pluginDir", path, "err", err)
					return nil
				}

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
		return []string{}, err
	}

	return pluginJSONPaths, nil
}

func (f *FS) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	f.log.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return plugins.JSONData{}, ErrInvalidPluginJSONFilePath
	}

	absPluginJSONPath, err := filepath.Abs(pluginJSONPath)
	if err != nil {
		return plugins.JSONData{}, err
	}

	// Wrapping in filepath.Clean to properly handle
	// gosec G304 Potential file inclusion via variable rule.
	reader, err := os.Open(filepath.Clean(absPluginJSONPath))
	if err != nil {
		return plugins.JSONData{}, err
	}
	defer func() {
		if reader == nil {
			return
		}
		if err = reader.Close(); err != nil {
			f.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
		}
	}()

	plugin := plugins.JSONData{}
	if err = json.NewDecoder(reader).Decode(&plugin); err != nil {
		return plugins.JSONData{}, err
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

func validatePluginJSON(data plugins.JSONData) error {
	if data.ID == "" || !data.Type.IsValid() {
		return ErrInvalidPluginJSON
	}
	return nil
}

func collectFilesWithin(dir string) (map[string]struct{}, error) {
	files := map[string]struct{}{}
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.Mode()&os.ModeSymlink == os.ModeSymlink {
			symlinkPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}

			symlink, err := os.Stat(symlinkPath)
			if err != nil {
				return err
			}

			// verify that symlinked file is within plugin directory
			p, err := filepath.Rel(dir, symlinkPath)
			if err != nil {
				return err
			}
			if p == ".." || strings.HasPrefix(p, ".."+string(filepath.Separator)) {
				return fmt.Errorf("file '%s' not inside of plugin directory", p)
			}

			// skip adding symlinked directories
			if symlink.IsDir() {
				return nil
			}
		}

		// skip directories
		if info.IsDir() {
			return nil
		}

		// verify that file is within plugin directory
		file, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		if strings.HasPrefix(file, ".."+string(filepath.Separator)) {
			return fmt.Errorf("file '%s' not inside of plugin directory", file)
		}

		files[path] = struct{}{}

		return nil
	})

	return files, err
}
