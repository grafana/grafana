package fs

import (
	"context"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Service struct {
	pluginStore plugins.Store
	log         log.Logger
}

func ProvideService(pluginStore plugins.Store) *Service {
	return &Service{
		pluginStore: pluginStore,
		log:         log.New("manager.fs"),
	}
}

func (s *Service) GetFile(ctx context.Context, pluginID, filename string) (*plugins.File, error) {
	if p, exists := s.pluginStore.Plugin(ctx, pluginID); exists {
		f, err := p.File(filename)
		if err != nil {
			return nil, err
		}
		defer func() {
			err = f.Close()
			if err != nil {
				s.log.Error("Could not close plugin file", "pluginID", p.ID, "file", filename)
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
