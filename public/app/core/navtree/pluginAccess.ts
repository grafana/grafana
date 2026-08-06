import { generatedAPI as legacyAPI } from '@grafana/api-clients/internal/rtkq/legacy';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';

// The wildcard scopes that satisfy a plugins:id:<id> requirement, mirroring
// the Go evaluator's WildcardsFromPrefix('plugins:id:') derivation
// (pkg/services/accesscontrol/scope.go)
const PLUGIN_SCOPE_WILDCARDS = ['*', 'plugins:*', 'plugins:id:*'];

/**
 * Fetches the scopes the user holds for the plugins.app:access action, so the
 * plugin nav can be evaluated per plugin like the server builder does
 * (applinks.go evaluates plugins:id:<id> per app; the bootdata permissions map
 * flattens scopes away). Resolves null when the scoped data is unavailable —
 * signed-out users (the endpoint requires a session), a multi-tenant
 * deployment without the single-tenant API, or any fetch failure — in which
 * case the caller falls back to the coarse action-only gate. Interim until an
 * apiserver access review can serve this without the /api dependency.
 */
export async function fetchAppAccessScopes(): Promise<ReadonlySet<string> | null> {
  try {
    const request = dispatch(legacyAPI.endpoints.getUserPermissions.initiate());
    try {
      const permissions = await request.unwrap();
      return new Set(permissions[AccessControlAction.PluginsAppAccess] ?? []);
    } finally {
      request.unsubscribe();
    }
  } catch {
    return null;
  }
}

/** Whether the scopes satisfy plugins.app:access for the given plugin */
export function hasScopedAppAccess(scopes: ReadonlySet<string>, pluginId: string): boolean {
  return scopes.has(`plugins:id:${pluginId}`) || PLUGIN_SCOPE_WILDCARDS.some((wildcard) => scopes.has(wildcard));
}
