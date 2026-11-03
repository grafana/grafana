import { getBackendSrv, logError } from '@grafana/runtime';
import { API_GROUP, API_VERSION, type UserPermissions } from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage, getAPIBaseURL } from 'app/api/utils';
import { setAppAccessScopes } from 'app/core/navtree/pluginAccess';
import { AccessControlAction, type UserPermission } from 'app/types/accessControl';

/**
 * Loads the current user's effective permissions from the multi-tenant AuthZ
 * user-permissions API as an action-keyed lookup map. Isolated here so the
 * underlying API can be swapped without touching callers.
 */
export async function loadUserPermissions(): Promise<UserPermission | null> {
  try {
    const { permissions } = await getBackendSrv().get<UserPermissions>(
      // TODO: After the backend has been deployed we can shift the frontend to target the cluster scoped url
      // `/apis/${API_GROUP}/${API_VERSION}/whoami/permissions`,
      `${getAPIBaseURL(API_GROUP, API_VERSION)}/users/~/permissions`,
      // Recompute rather than serving the cached AuthZ snapshot: callers use this
      // to observe permissions they were just granted. Older servers without the
      // parameter ignore it and answer from the cache as before
      { skipCache: true },
      undefined,
      // Callers fall back to the permissions they already have, so a failure is
      // not worth a toast on top of that — boot in particular has no context to
      // show one against
      { showErrorAlert: false }
    );

    // The nav gates each app plugin on its own plugins:id:<id> scope, which the
    // action-keyed map below throws away. Hand them over before folding.
    setAppAccessScopes(
      new Set(
        // flatMap rather than filter + map: a filter predicate does not narrow
        // scope, which the response leaves optional
        permissions.flatMap(({ action, scope }) =>
          action === AccessControlAction.PluginsAppAccess && scope !== undefined ? [scope] : []
        )
      )
    );

    return permissions.reduce<UserPermission>((acc, { action }) => {
      acc[action] = true;
      return acc;
    }, {});
  } catch (error) {
    logError(new Error(extractErrorMessage(error, 'Failed to load user permissions')));
    // Null rather than an empty map, so callers keep whatever permissions boot
    // already gave them instead of downgrading to "no permissions". A
    // successful response carrying none still returns an empty map.
    return null;
  }
}
