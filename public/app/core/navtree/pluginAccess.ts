import { useMemo } from 'react';

import { useGetCurrentUserPermissionsQuery } from 'app/api/clients/iam/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { arePluginNavItemsEnabled } from './buildStaticNavTree';

// The wildcard scopes that satisfy a plugins:id:<id> requirement, mirroring
// the Go evaluator's WildcardsFromPrefixes('plugins:id:') derivation
const PLUGIN_SCOPE_WILDCARDS = ['*', 'plugins:*', 'plugins:id:*'];

/**
 * The scopes the user holds for plugins.app:access, so plugin nav items can be
 * gated per plugin like the server gates them (applinks.go evaluates
 * plugins:id:<id>; the bootdata permissions map flattens scopes away).
 *
 * Scopes are kept verbatim, empty strings included: an unscoped org-wide grant
 * does not satisfy a scoped requirement in the Go evaluator, nor here.
 */
export function useAppAccessScopes(): {
  /** Null when the request failed or was skipped: the caller falls back to the unscoped check */
  scopes: ReadonlySet<string> | null;
  isLoading: boolean;
} {
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
