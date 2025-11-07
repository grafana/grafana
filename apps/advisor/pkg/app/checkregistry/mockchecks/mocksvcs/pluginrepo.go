package mocksvcs

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/repo"
)

type PluginRepo struct {
	repo.Service
}

func (m *PluginRepo) GetPluginsInfo(ctx context.Context, options repo.GetPluginsInfoOptions, compatOpts repo.CompatOpts) ([]repo.PluginInfo, error) {
	return []repo.PluginInfo{
		{
			ID:      1,
			Slug:    "grafana-piechart-panel",
			Version: "1.6.0",
		},
		{
			ID:      2,
			Slug:    "prometheus",
			Version: "10.0.0",
		},
	}, nil
}
