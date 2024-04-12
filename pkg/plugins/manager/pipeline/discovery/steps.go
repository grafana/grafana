package discovery

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
)

// DefaultFindFunc is the default function used for the Find step of the Discovery stage. It will scan the local
// filesystem for plugins.
func DefaultFindFunc(cfg *config.PluginManagementCfg) FindFunc {
	return finder.NewLocalFinder(cfg.DevMode).Find
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
