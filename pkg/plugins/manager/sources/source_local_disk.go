package sources

import (
	"errors"
	"os"
	"path/filepath"
	"slices"

	"github.com/grafana/grafana/pkg/plugins"
)

type LocalSource struct {
	paths []string
	class plugins.Class
}

func NewLocalSource(class plugins.Class, paths []string) *LocalSource {
	return &LocalSource{
		class: class,
		paths: paths,
	}
}

func (s *LocalSource) PluginClass() plugins.Class {
	return s.class
}

func (s *LocalSource) PluginURIs() []string {
	return s.paths
}

func DirAsLocalSources(pluginsPath string, class plugins.Class) ([]*LocalSource, error) {
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
		sources[i] = NewLocalSource(class, []string{dir})
	}

	return sources, nil
}
