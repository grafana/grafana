import { logError } from '@grafana/runtime';
import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { dispatch } from 'app/store/store';
import { type UserPermission } from 'app/types/accessControl';

/**
 * Loads the current user's effective permissions from the multi-tenant AuthZ
 * user-permissions API as an action-keyed lookup map.
 *
 * Goes through the RTK Query endpoint rather than fetching directly so it
 * shares one cache entry — and so one request — with useAppAccessScopes, which
 * needs the scopes this map discards. A refresh here updates that hook's
 * subscribers too.
 */
export async function loadUserPermissions(): Promise<UserPermission | null> {
  try {
    const { permissions } = await dispatch(
      // forceRefetch because callers use this to observe permissions they were
      // just granted, and a cached entry would answer with the old set
      // TODO: pass skipCache once the endpoint's parameter reaches the
      // generated client, so the server recomputes rather than serving its own
      // cached snapshot
      iamAPIv0alpha1.endpoints.getCurrentUserPermissions.initiate(undefined, { forceRefetch: true })
    ).unwrap();

    const actions: UserPermission = {};
    for (const { action } of permissions) {
      actions[action] = true;
    }
    return actions;
  } catch (error) {
    logError(new Error(extractErrorMessage(error, 'Failed to load user permissions')));
    // Null rather than an empty map, so callers keep whatever permissions boot
    // already gave them instead of downgrading to "no permissions". A
    // successful response carrying none still returns an empty map.
    return null;
  }
}
