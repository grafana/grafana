import { getBackendSrv, logError } from '@grafana/runtime';
import { API_GROUP, API_VERSION, type UserPermissions } from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage, getAPIBaseURL } from 'app/api/utils';
import { type UserPermission } from 'app/types/accessControl';

/**
 * Loads the current user's effective permissions from the multi-tenant AuthZ
 * user-permissions API as an action-keyed lookup map. Isolated here so the
 * underlying API can be swapped without touching callers.
 */
export async function loadUserPermissions(): Promise<UserPermission | null> {
  try {
    const { permissions } = await getBackendSrv().get<UserPermissions>(
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
