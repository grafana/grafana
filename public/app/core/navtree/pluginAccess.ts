// The wildcard scopes that satisfy a plugins:id:<id> requirement, mirroring
// the Go evaluator's WildcardsFromPrefixes('plugins:id:') derivation
const PLUGIN_SCOPE_WILDCARDS = ['*', 'plugins:*', 'plugins:id:*'];

/**
 * The scopes the user holds for plugins.app:access, so plugin nav items can be
 * gated per plugin like the server gates them (applinks.go evaluates
 * plugins:id:<id>; the bootdata permissions map flattens scopes away).
 *
 * Module state rather than redux: the nav tree is built inside configureStore,
 * so there is no store to read when these are needed. loadUserPermissions owns
 * the request and fills this from the one response that still carries scopes.
 *
 * Null means the scopes are unavailable — the request failed, or it was never
 * made because the deployment does not fetch permissions. Callers then fall
 * back to the unscoped check, which is the behaviour without this feature.
 */
let appAccessScopes: ReadonlySet<string> | null = null;

/**
 * Records the plugins.app:access scopes. Scopes are kept verbatim, empty
 * strings included: an unscoped org-wide grant does not satisfy a scoped
 * requirement in the Go evaluator, nor here.
 */
export function setAppAccessScopes(scopes: ReadonlySet<string> | null): void {
  appAccessScopes = scopes;
}

/** Whether the scopes satisfy plugins.app:access for the given plugin */
export function hasScopedAppAccess(scopes: ReadonlySet<string>, pluginId: string): boolean {
  return scopes.has(`plugins:id:${pluginId}`) || PLUGIN_SCOPE_WILDCARDS.some((wildcard) => scopes.has(wildcard));
}

/**
 * The recorded scopes, or null when there are none to go on. Deliberately not
 * combined with the unscoped permission check here: context_srv loads the
 * permissions that fill this, so importing it back would close a cycle.
 */
export function getAppAccessScopes(): ReadonlySet<string> | null {
  return appAccessScopes;
}
