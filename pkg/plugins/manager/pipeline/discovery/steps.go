package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// DefaultFindFunc is the default function used for the Find step of the Discovery stage. It will scan the local
// filesystem for plugins.
func DefaultFindFunc(cfg *config.Cfg) FindFunc {
	return finder.NewLocalFinder(cfg.DevMode).Find
}

// DuplicatePluginValidation is a filter step that will filter out any plugins that are already registered with the
// registry. This includes both the primary plugin and any child plugins, which are matched using the plugin ID field.
type DuplicatePluginValidation struct {
	registry registry.Service
	log      log.Logger
}

// NewDuplicatePluginFilterStep returns a new DuplicatePluginValidation.
func NewDuplicatePluginFilterStep(registry registry.Service) *DuplicatePluginValidation {
	return &DuplicatePluginValidation{
		registry: registry,
		log:      log.New("plugins.dedupe"),
	}
}

// Filter will filter out any plugins that are already registered with the registry.
func (d *DuplicatePluginValidation) Filter(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	res := make([]*plugins.FoundBundle, 0, len(bundles))
	for _, b := range bundles {
		_, exists := d.registry.Plugin(ctx, b.Primary.JSONData.ID)
		if exists {
			d.log.Warn("Skipping loading of plugin as it's a duplicate", "pluginId", b.Primary.JSONData.ID)
			continue
		}

		for _, child := range b.Children {
			_, exists = d.registry.Plugin(ctx, child.JSONData.ID)
			if exists {
				d.log.Warn("Skipping loading of child plugin as it's a duplicate", "pluginId", child.JSONData.ID)
				continue
			}
		}
		res = append(res, b)
	}

	return res, nil
}

// SkipPlugins is a filter step that will filter out any configured plugins
type SkipPlugins struct {
	log log.Logger
	cfg *config.Cfg
}

// NewSkipPluginsStep returns a new SkipPlugins.
func NewSkipPluginsStep(cfg *config.Cfg) *SkipPlugins {
	return &SkipPlugins{
		cfg: cfg,
		log: log.New("plugins.skip"),
	}
}

// Filter will filter out any plugins that are marked to be skipped.
func (c *SkipPlugins) Filter(bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	if len(c.cfg.SkipPlugins) == 0 {
		return bundles, nil
	}

	skipPluginsMap := make(map[string]bool)
	for _, pluginID := range c.cfg.SkipPlugins {
		skipPluginsMap[pluginID] = true
	}

	res := []*plugins.FoundBundle{}
	for _, bundle := range bundles {
		if skipPluginsMap[bundle.Primary.JSONData.ID] {
			c.log.Debug("Skipping plugin load", "pluginID", bundle.Primary.JSONData.ID)
		} else {
			res = append(res, bundle)
		}
	}
	return res, nil
}
