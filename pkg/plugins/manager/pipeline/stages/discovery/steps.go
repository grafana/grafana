package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

func (d *Discovery) findStep(ctx context.Context, _ []*plugins.Plugin) ([]*plugins.FoundBundle, error) {
	// First step, plugin list is empty
	return d.pluginFinder.Find(ctx, d.src)
}

func (d *Discovery) filterStep(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	res := make([]*plugins.FoundBundle, 0)
	for _, b := range bundles {
		_, exists := d.pluginRegistry.Plugin(ctx, b.Primary.JSONData.ID)
		if exists {
			d.log.Warn("Skipping loading of plugin as it's a duplicate", "pluginID", b.Primary.JSONData.ID)
			continue
		}

		for _, child := range b.Children {
			_, exists = d.pluginRegistry.Plugin(ctx, child.JSONData.ID)
			if exists {
				d.log.Warn("Skipping loading of child plugin as it's a duplicate", "pluginID", child.JSONData.ID)
				continue
			}
		}
		res = append(res, b)
	}

	return res, nil
}
