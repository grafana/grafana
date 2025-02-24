package sources

import (
	"context"
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

func (s *LocalSource) PluginClass(_ context.Context) plugins.Class {
	return s.class
}

func (s *LocalSource) PluginURIs(_ context.Context) []string {
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
