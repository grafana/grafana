package meta

import (
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

// pluginAPIs returns the API groups the frontend should target for a plugin.
// Every provider (core, local and catalog) derives spec.apis from here.
//
// TODO: this reports the group and version Grafana serves every plugin at by default.
// Once plugins declare their own, read them here; the catalog provider has no plugin files yet.
func pluginAPIs(pluginID string, pluginType pluginsv0alpha1.MetaJSONDataType) []pluginsv0alpha1.MetaAPI {
	group, version, ok := plugins.DefaultAPIGroupVersion(pluginID, plugins.Type(pluginType))
	if !ok {
		return nil
	}
	return []pluginsv0alpha1.MetaAPI{{
		Group:            group,
		PreferredVersion: version,
		Versions:         []string{version},
	}}
}
