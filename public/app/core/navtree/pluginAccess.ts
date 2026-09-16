import { useMemo } from 'react';

import { useGetCurrentUserPermissionsQuery } from 'app/api/clients/iam/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { arePluginNavItemsEnabled } from './buildStaticNavTree';

// The wildcard scopes that satisfy a plugins:id:<id> requirement, mirroring
// the Go evaluator's WildcardsFromPrefixes('plugins:id:') derivation
const PLUGIN_SCOPE_WILDCARDS = ['*', 'plugins:*', 'plugins:id:*'];

/**
 * The scopes the user holds for plugins.app:access, so the plugin nav can be
 * evaluated per plugin like the server builder does (applinks.go evaluates
 * plugins:id:<id> per app, while the bootdata permissions map flattens scopes
 * away).
 *
 * `scopes` is null when the query failed or was skipped, which tells the
 * caller to fall back to the coarse action-only check. `isLoading` is
 * reported separately so a caller that merges once can wait for the answer
 * rather than merging with the fallback and never revisiting it.
 *
 * Scopes are kept as the API returned them, empty strings included: an
 * unscoped org-wide grant does not satisfy a scoped requirement in the Go
 * evaluator, and neither does it here.
 */
export function useAppAccessScopes(): { scopes: ReadonlySet<string> | null; isLoading: boolean } {
  const { data, isLoading } = useGetCurrentUserPermissionsQuery(undefined, { skip: !arePluginNavItemsEnabled() });

  const scopes = useMemo(() => {
    if (!data) {
      return null;
    }
    return new Set(
      data.permissions.filter(({ action }) => action === AccessControlAction.PluginsAppAccess).map(({ scope }) => scope)
    );
  }, [data]);

  return { scopes, isLoading };
}

/** Whether the scopes satisfy plugins.app:access for the given plugin */
export function hasScopedAppAccess(scopes: ReadonlySet<string>, pluginId: string): boolean {
  return scopes.has(`plugins:id:${pluginId}`) || PLUGIN_SCOPE_WILDCARDS.some((wildcard) => scopes.has(wildcard));
}
