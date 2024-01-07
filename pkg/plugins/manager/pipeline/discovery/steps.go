package discovery

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// DefaultFindFunc is the default function used for the Find step of the Discovery stage. It will scan the local
// filesystem for plugins.
func DefaultFindFunc(cfg *config.Cfg) FindFunc {
	return finder.NewLocalFinder(cfg.DevMode, cfg.Features).Find
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

// PermittedPluginTypesFilter is a filter step that will filter out any plugins that are not of a permitted type.
type PermittedPluginTypesFilter struct {
	permittedTypes []plugins.Type
}

// NewPermittedPluginTypesFilterStep returns a new FindFilterFunc for filtering out any plugins that are not of a
// permitted type. This includes both the primary plugin and any child plugins.
func NewPermittedPluginTypesFilterStep(permittedTypes []plugins.Type) FindFilterFunc {
	f := &PermittedPluginTypesFilter{
		permittedTypes: permittedTypes,
	}
	return f.Filter
}

// Filter will filter out any plugins that are not of a permitted type.
func (n *PermittedPluginTypesFilter) Filter(_ context.Context, _ plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	var r []*plugins.FoundBundle
	for _, b := range bundles {
		if !slices.Contains(n.permittedTypes, b.Primary.JSONData.Type) {
			continue
		}

		prohibitedType := false
		for _, child := range b.Children {
			if !slices.Contains(n.permittedTypes, child.JSONData.Type) {
				prohibitedType = true
				break
			}
		}
		if !prohibitedType {
			r = append(r, b)
		}
	}
	return r, nil
}
