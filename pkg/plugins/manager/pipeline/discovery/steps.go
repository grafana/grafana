package discovery

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/plugins"
)

// PermittedPluginTypesFilter is a filter step that will filter out any plugins that are not of a permitted type.
type PermittedPluginTypesFilter struct {
	permittedTypes []plugins.Type
}

// NewPermittedPluginTypesFilterStep returns a new FilterFunc for filtering out any plugins that are not of a
// permitted type. This includes both the primary plugin and any child plugins.
func NewPermittedPluginTypesFilterStep(permittedTypes []plugins.Type) FilterFunc {
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
