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
	logger := log.New("plugin.finder")
	return &Service{
		local:  newFS(logger),
		remote: newRemote(logger),
		log:    logger,
	}
}

func (f *Service) Find(ctx context.Context, pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	fbs := make(map[string][]*plugins.FoundBundle)
	for _, path := range pluginPaths {
		if strings.HasPrefix(path, "http") {
			remote, err := f.remote.Find(ctx, path)
			if err != nil {
				f.log.Warn("Error occurred when trying to find plugin", "path", path)
				continue
			}
			fbs[path] = remote
			continue
		}
		local, err := f.local.Find(ctx, path)
		if err != nil {
			f.log.Warn("Error occurred when trying to find plugin", "path", path)
			continue
		}
		fbs[path] = local
	}

	var found []*plugins.FoundBundle
	for _, fb := range fbs {
		found = append(found, fb...)
	}

	return found, nil
}
