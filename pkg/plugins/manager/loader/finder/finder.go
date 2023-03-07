package finder

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Service struct {
	local *FS
	log   log.Logger
}

func NewService() *Service {
	logger := log.New("plugin.finder")
	return &Service{
		local: newFS(logger),
		log:   logger,
	}
}

func (f *Service) Find(ctx context.Context, pluginPaths ...string) ([]*plugins.FoundBundle, error) {
	if len(pluginPaths) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	fbs := make(map[string][]*plugins.FoundBundle)
	for _, path := range pluginPaths {
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
