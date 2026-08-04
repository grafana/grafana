package pluginstore

import "context"

// CanonicalPluginID resolves a plugin ID or one of its aliasIDs to the plugin's canonical ID.
//
// Plugin renames are expressed as aliasIDs (e.g. the Pyroscope data source plugin is
// "grafana-pyroscope-datasource" and keeps "phlare" as an alias), and identifiers recorded
// before a rename are never rewritten. Callers that compare a recorded identifier against a
// current one therefore need to normalize both sides first.
//
// Identifiers the store cannot resolve are returned unchanged, so callers keep working for
// plugins that are not installed.
func CanonicalPluginID(ctx context.Context, store Store, idOrAlias string) string {
	if store == nil || idOrAlias == "" {
		return idOrAlias
	}
	if p, ok := store.Plugin(ctx, idOrAlias); ok && p.ID != "" {
		return p.ID
	}
	return idOrAlias
}

// SamePlugin reports whether two plugin identifiers refer to the same plugin, treating a
// canonical ID and any of its aliasIDs as equal. Identifiers the store cannot resolve only
// match themselves.
func SamePlugin(ctx context.Context, store Store, a, b string) bool {
	if a == b {
		return true
	}
	return CanonicalPluginID(ctx, store, a) == CanonicalPluginID(ctx, store, b)
}
