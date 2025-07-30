package sources

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
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

type LocalSource struct {
	paths      []string
	class      plugins.Class
	strictMode bool // If true, tracks files via a StaticFS
	log        log.Logger
}

// NewLocalSource represents a plugin with a fixed set of files.
func NewLocalSource(class plugins.Class, paths []string) *LocalSource {
	return &LocalSource{
		paths:      paths,
		class:      class,
		strictMode: true,
		log:        log.New("local.source"),
	}
}

// NewUnsafeLocalSource represents a plugin that has an unbounded set of files. This useful when running in
// dev mode whilst developing a plugin.
func NewUnsafeLocalSource(class plugins.Class, paths []string) *LocalSource {
	return &LocalSource{
		paths:      paths,
		class:      class,
		strictMode: false,
		log:        log.New("local.source"),
	}
}

func (s *LocalSource) PluginClass(_ context.Context) plugins.Class {
	return s.class
}

// Paths returns the file system paths that this source will search for plugins.
// This method is primarily intended for testing purposes.
func (s *LocalSource) Paths() []string {
	return s.paths
}

func (s *LocalSource) DefaultSignature(_ context.Context, _ string) (plugins.Signature, bool) {
	switch s.class {
	case plugins.ClassCore:
		return plugins.Signature{
			Status: plugins.SignatureStatusInternal,
		}, true
	default:
		return plugins.Signature{}, false
	}
}

func (s *LocalSource) Discover(_ context.Context) ([]*plugins.FoundBundle, error) {
	if len(s.paths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	pluginJSONPaths := make([]string, 0, len(s.paths))
	for _, path := range s.paths {
		exists, err := fs.Exists(path)
		if err != nil {
			s.log.Warn("Skipping finding plugins as an error occurred", "path", path, "error", err)
			continue
		}
		if !exists {
			s.log.Warn("Skipping finding plugins as directory does not exist", "path", path)
			continue
		}

		paths, err := s.getAbsPluginJSONPaths(path)
		if err != nil {
			return nil, err
		}
		pluginJSONPaths = append(pluginJSONPaths, paths...)
	}

	// load plugin.json files and map directory to JSON data
	foundPlugins := make(map[string]plugins.JSONData)
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := s.readPluginJSON(pluginJSONPath)
		if err != nil {
			s.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			s.log.Warn("Skipping plugin loading as absolute plugin.json path could not be calculated", "pluginId", plugin.ID, "error", err)
			continue
		}

		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	res := make(map[string]*plugins.FoundBundle)
	for pluginDir, data := range foundPlugins {
		var pluginFs plugins.FS
		pluginFs = plugins.NewLocalFS(pluginDir)
		if s.strictMode {
			// Tighten up security by allowing access only to the files present up to this point.
			// Any new file "sneaked in" won't be allowed and will act as if the file does not exist.
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

	// Track child plugins and add them to their parent.
	childPlugins := make(map[string]struct{})
	for dir, p := range res {
		// Check if this plugin is the parent of another plugin.
		for dir2, p2 := range res {
			if dir == dir2 {
				continue
			}

			relPath, err := filepath.Rel(dir, dir2)
			if err != nil {
				s.log.Error("Cannot calculate relative path. Skipping", "pluginId", p2.Primary.JSONData.ID, "err", err)
				continue
			}
			if !strings.Contains(relPath, "..") {
				child := p2.Primary
				s.log.Debug("Adding child", "parent", p.Primary.JSONData.ID, "child", child.JSONData.ID, "relPath", relPath)
				p.Children = append(p.Children, &child)
				childPlugins[dir2] = struct{}{}
			}
		}
	}

	// Remove child plugins from the result (they are already tracked via their parent).
	result := make([]*plugins.FoundBundle, 0, len(res))
	for k := range res {
		if _, ok := childPlugins[k]; !ok {
			result = append(result, res[k])
		}
	}

	return result, nil
}

func (s *LocalSource) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	reader, err := s.readFile(pluginJSONPath)
	defer func() {
		if reader == nil {
			return
		}
		if err = reader.Close(); err != nil {
			s.log.Warn("Failed to close plugin JSON file", "path", pluginJSONPath, "error", err)
		}
	}()
	if err != nil {
		s.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
		return plugins.JSONData{}, err
	}
	plugin, err := plugins.ReadPluginJSON(reader)
	if err != nil {
		s.log.Warn("Skipping plugin loading as its plugin.json could not be read", "path", pluginJSONPath, "error", err)
		return plugins.JSONData{}, err
	}

	return plugin, nil
}

func (s *LocalSource) getAbsPluginJSONPaths(path string) ([]string, error) {
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
					s.log.Error("Couldn't scan directory since it doesn't exist", "pluginDir", path, "error", err)
					return nil
				}
				if errors.Is(err, os.ErrPermission) {
					s.log.Error("Couldn't scan directory due to lack of permissions", "pluginDir", path, "error", err)
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

func (s *LocalSource) readFile(pluginJSONPath string) (io.ReadCloser, error) {
	s.log.Debug("Loading plugin", "path", pluginJSONPath)

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

func DirAsLocalSources(cfg *config.PluginManagementCfg, pluginsPath string, class plugins.Class) ([]*LocalSource, error) {
	if pluginsPath == "" {
		return []*LocalSource{}, errors.New("plugins path not configured")
	}

	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	d, err := os.ReadDir(pluginsPath)
	if err != nil {
		return []*LocalSource{}, errors.New("failed to open plugins path")
	}

	var pluginDirs []string
	for _, dir := range d {
		if dir.IsDir() || dir.Type()&os.ModeSymlink == os.ModeSymlink {
			pluginDirs = append(pluginDirs, filepath.Join(pluginsPath, dir.Name()))
		}
	}
	slices.Sort(pluginDirs)

	sources := make([]*LocalSource, len(pluginDirs))
	for i, dir := range pluginDirs {
		if cfg.DevMode {
			sources[i] = NewUnsafeLocalSource(class, []string{dir})
		} else {
			sources[i] = NewLocalSource(class, []string{dir})
		}
	}

	return sources, nil
}
