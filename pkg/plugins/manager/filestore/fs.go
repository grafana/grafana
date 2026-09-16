package filestore

import (
	"context"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// buildResolver is an optional capability of a registry that can resolve a
// specific retained build by its buildHash (F1-T2). When the injected registry
// implements it, filestore serves assets from the addressed build; otherwise it
// falls back to the active-build lookup, preserving legacy behaviour.
type buildResolver interface {
	Build(ctx context.Context, pluginID, buildHash string) (*plugins.Plugin, bool)
}

type Service struct {
	pluginRegistry registry.Service
	log            log.Logger
}

func ProvideService(pluginRegistry registry.Service) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugin.fs"),
	}
}

// File serves an asset from the plugin's ACTIVE build. The pluginVersion argument is
// a plugin version string (e.g. "1.0.0"), not a content buildHash: the registry
// resolves the active build and ignores the version, preserving legacy behaviour for
// callers such as plugin markdown and plugin dashboards. Build-addressed serving of a
// specific retained build goes through BuildFile, keyed by the content buildHash.
func (s *Service) File(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID, pluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotInstalled
	}
	return s.readPluginFile(p, filename)
}

// BuildFile serves an asset from a specific retained build addressed by its content
// buildHash (the build-addressed route, FR-001). Unlike File it never falls back to
// the active build: an unknown or evicted buildHash returns ErrPluginNotInstalled so
// the route can answer 410/404 rather than silently serving different bytes. If the
// registry does not support retained builds, it likewise reports not-installed.
func (s *Service) BuildFile(ctx context.Context, pluginID, buildHash, filename string) (*plugins.File, error) {
	br, ok := s.pluginRegistry.(buildResolver)
	if !ok {
		return nil, plugins.ErrPluginNotInstalled
	}
	p, exists := br.Build(ctx, pluginID, buildHash)
	if !exists {
		return nil, plugins.ErrPluginNotInstalled
	}
	return s.readPluginFile(p, filename)
}

// readPluginFile reads a single asset from a plugin build and returns its content
// and mod time. Returns plugins.ErrFileNotExist when the build does not contain it.
func (s *Service) readPluginFile(p *plugins.Plugin, filename string) (*plugins.File, error) {
	f, err := p.File(filename)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := f.Close(); cerr != nil {
			s.log.Error("Could not close plugin file", "pluginId", p.ID, "file", filename)
		}
	}()

	b, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	fi, err := f.Stat()
	if err != nil {
		return nil, err
	}
	return &plugins.File{Content: b, ModTime: fi.ModTime()}, nil
}
