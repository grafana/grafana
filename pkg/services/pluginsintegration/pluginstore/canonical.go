package pluginstore

import "context"

// CanonicalPluginID resolves a plugin ID or one of its aliasIDs to the plugin's canonical ID.
// A rename only adds an aliasID, so identifiers recorded before one still hold the old ID.
// Identifiers the store cannot resolve are returned unchanged.
func CanonicalPluginID(ctx context.Context, store Store, idOrAlias string) string {
	if store == nil || idOrAlias == "" {
		return idOrAlias
	}
	if p, ok := store.Plugin(ctx, idOrAlias); ok && p.ID != "" {
		return p.ID
	}
	return idOrAlias
}

// SamePlugin reports whether two identifiers refer to the same plugin, treating a canonical ID
// and any of its aliasIDs as equal.
func SamePlugin(ctx context.Context, store Store, a, b string) bool {
	if a == b {
		return true
	}
	return CanonicalPluginID(ctx, store, a) == CanonicalPluginID(ctx, store, b)
}
