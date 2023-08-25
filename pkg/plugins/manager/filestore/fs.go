package filestore

import (
	"context"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

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

func (s *Service) File(ctx context.Context, pluginID, version, filename string) (*plugins.File, error) {
	if p, exists := s.pluginRegistry.Plugin(ctx, pluginID, version); exists {
		f, err := p.File(filename)
		if err != nil {
			return nil, err
		}
		defer func() {
			err = f.Close()
			if err != nil {
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

		return &plugins.File{
			Content: b,
			ModTime: fi.ModTime(),
		}, nil
	} else {
		return nil, plugins.ErrPluginNotInstalled
	}
}

func (s *Service) RemoveAll(ctx context.Context, pluginID, version string) error {
	if p, exists := s.pluginRegistry.Plugin(ctx, pluginID, version); exists {
		if remover, ok := p.FS.(plugins.FSRemover); ok {
			if err := remover.Remove(); err != nil {
				s.log.Error("Could not remove plugin files", "pluginId", pluginID, "version", version)
			}
		}
	}
	return nil
}
