package finder

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/util"
)

var walk = util.Walk

var (
	ErrInvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

type Local struct {
	log        log.Logger
	production bool
}

func NewLocalFinder(devMode bool) *Local {
	return &Local{
		production: !devMode,
		log:        log.New("local.finder"),
	}
}

func ProvideLocalFinder(cfg *config.Cfg) *Local {
	return NewLocalFinder(cfg.DevMode)
}

func (l *Local) Find(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	if len(src.PluginURIs(ctx)) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	pluginURIs := src.PluginURIs(ctx)
	pluginJSONPaths := make([]string, 0, len(pluginURIs))
	for _, rootPath := range pluginURIs {
		exists, err := fs.Exists(rootPath)
		if err != nil {
			l.log.Warn("Skipping finding plugins as an error occurred", "path", rootPath, "error", err)
			continue
		}
		if !exists {
			l.log.Warn("Skipping finding plugins as directory does not exist", "path", rootPath)
			continue
		}

		paths, err := l.getAbsPluginJSONPaths(rootPath, src.PluginClass(ctx))
		if err != nil {
			return nil, err
		}
		pluginJSONPaths = append(pluginJSONPaths, paths...)
	}

	// load plugin.json files and map directory to JSON data
	foundPlugins := make(map[string]plugins.JSONData)
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			l.log.Warn("Skipping plugin loading as absolute plugin.json path could not be calculated", "pluginId", plugin.ID, "error", err)
			continue
		}

		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	res := make(map[string]*plugins.FoundBundle)
	for pluginDir, data := range foundPlugins {
		var pluginFs plugins.FS
		pluginFs = plugins.NewLocalFS(pluginDir)
		if l.production {
			// In prod, tighten up security by allowing access only to the files present up to this point.
			// Any new file "sneaked in" won't be allowed and will acts as if the file did not exist.
			var err error
			pluginFs, err = plugins.NewStaticFS(pluginFs)
			if err != nil {
				return nil, err
			}
		}
		res[pluginDir] = &plugins.FoundBundle{
			Primary: plugins.FoundPlugin{
				JSONData: data,
				FS:       pluginFs,
			},
		}
	}

	result := make([]*plugins.FoundBundle, 0, len(foundPlugins))
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

func (l *Local) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	reader, err := l.readFile(pluginJSONPath)
	defer func() {
		if reader == nil {
			return
		}
		if err = reader.Close(); err != nil {
			l.log.Warn("Failed to close plugin JSON file", "path", pluginJSONPath, "error", err)
		}
	}()
	if err != nil {
		l.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
		return plugins.JSONData{}, err
	}
	plugin, err := plugins.ReadPluginJSON(reader)
	if err != nil {
		l.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
		return plugins.JSONData{}, err
	}

	return plugin, nil
}

func (l *Local) getAbsPluginJSONPaths(rootPath string, class plugins.Class) ([]string, error) {
	pluginJSONPaths := map[string]struct{}{}

	var err error
	rootPath, err = filepath.Abs(rootPath)
	if err != nil {
		return []string{}, err
	}

	followDistFolder := true
	if class == plugins.ClassCore || class == plugins.ClassBundled {
		followDistFolder = false
	}

	if err = walk(rootPath, true, true,
		func(currentPath string, fi os.FileInfo, err error) error {
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					l.log.Error("Couldn't scan directory since it doesn't exist", "pluginDir", rootPath, "error", err)
					return nil
				}
				if errors.Is(err, os.ErrPermission) {
					l.log.Error("Couldn't scan directory due to lack of permissions", "pluginDir", rootPath, "error", err)
					return nil
				}

				return fmt.Errorf("filepath.Walk reported an error for %q: %w", currentPath, err)
			}

			switch {
			case fi.Name() == "node_modules":
				return util.ErrWalkSkipDir
			case fi.Name() == "dist" && !followDistFolder:
				return util.ErrWalkSkipDir
			case fi.IsDir():
				return nil
			case fi.Name() != "plugin.json":
				return nil
			}

			pluginJSONPaths[currentPath] = struct{}{}
			return nil
		}); err != nil {
		return []string{}, err
	}

	// For external plugins, if we found a plugin directory that contains a "dist" directory, we want to ignore duplicate
	// plugin.json files found in the parent folder if they exist.
	// For example, if we found encountered /path/to/plugin/dist/plugin.json, we want to ignore the paths
	// /path/to/plugin/plugin.json and /path/to/plugin/src/plugin.json in order to prioritize the built
	// version and avoid loading the plugin twice.
	if class == plugins.ClassExternal {
		for pluginJSONPath := range pluginJSONPaths {
			pluginDir := filepath.Dir(pluginJSONPath)

			// If we found a plugin folder named "dist" at the root level, there should not be any duplicates to remove
			if filepath.Join(rootPath, "dist") == pluginDir {
				continue
			}

			if filepath.Base(pluginDir) == "dist" {
				delete(pluginJSONPaths, filepath.Join(filepath.Dir(pluginDir), "plugin.json"))
				delete(pluginJSONPaths, filepath.Join(filepath.Dir(pluginDir), "src", "plugin.json"))
			}
		}
	}

	res := make([]string, 0, len(pluginJSONPaths))
	for v := range pluginJSONPaths {
		res = append(res, v)
	}

	return res, nil
}

func (l *Local) readFile(pluginJSONPath string) (io.ReadCloser, error) {
	l.log.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return nil, ErrInvalidPluginJSONFilePath
	}

	absPluginJSONPath, err := filepath.Abs(pluginJSONPath)
	if err != nil {
		return nil, err
	}

	// Wrapping in filepath.Clean to properly handle
	// gosec G304 Potential file inclusion via variable rule.
	return os.Open(filepath.Clean(absPluginJSONPath))
}
