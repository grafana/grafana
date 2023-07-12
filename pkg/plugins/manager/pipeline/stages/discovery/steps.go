package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

var DefaultFindFunc = func(cfg *config.Cfg) FindFunc {
	return finder.NewLocalFinder(cfg).Find
}

var DefaultFindFilterFunc = func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	return bundles, nil
}

type DuplicatePluginValidation struct {
	registry registry.Service
	log      log.Logger
}

func NewDuplicatePluginFilterStep(registry registry.Service) *DuplicatePluginValidation {
	return &DuplicatePluginValidation{
		registry: registry,
		log:      log.New("duplicate.checker"),
	}
}

func (d *DuplicatePluginValidation) Filter(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	res := make([]*plugins.FoundBundle, 0, len(bundles))
	for _, b := range bundles {
		_, exists := d.registry.Plugin(ctx, b.Primary.JSONData.ID)
		if exists {
			d.log.Warn("Skipping loading of plugin as it's a duplicate", "pluginID", b.Primary.JSONData.ID)
			continue
		}

		for _, child := range b.Children {
			_, exists = d.registry.Plugin(ctx, child.JSONData.ID)
			if exists {
				d.log.Warn("Skipping loading of child plugin as it's a duplicate", "pluginID", child.JSONData.ID)
				continue
			}
		}
		res = append(res, b)
	}

	return res, nil
}
