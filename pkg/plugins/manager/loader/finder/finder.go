package finder

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

type Service struct {
	local  *FS
	remote *HTTP
	log    log.Logger
}

func NewService() *Service {
	return &Service{
		local:  newFS(),
		remote: newRemote(),
		log:    log.New("plugin.finder"),
	}
}

func (f *Service) Find(ctx context.Context, pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	var found []*plugins.FoundBundle
	for _, path := range pluginPaths {
		if strings.HasPrefix(path, "http") {
			remote, err := f.remote.Find(ctx, path)
			if err != nil {
				f.log.Warn("Error occurred when trying to find plugin", "path", path)
				continue
			}
			found = append(found, remote...)
			continue
		}
		local, err := f.local.Find(ctx, path)
		if err != nil {
			f.log.Warn("Error occurred when trying to find plugin", "path", path)
			continue
		}
		found = append(found, local...)
	}

	return found, nil
}
