package datasources

import (
	"context"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// CanonicalPluginType returns the plugin's canonical ID when pluginStore can resolve
// typeOrAlias (including via aliasIDs). If the store is nil or the type is unknown,
// typeOrAlias is returned unchanged.
func CanonicalPluginType(ctx context.Context, pluginStore pluginstore.Store, typeOrAlias string) string {
	if pluginStore == nil || typeOrAlias == "" {
		return typeOrAlias
	}
	if p, ok := pluginStore.Plugin(ctx, typeOrAlias); ok && p.ID != "" {
		return p.ID
	}
	return typeOrAlias
}
