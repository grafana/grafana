import { logError } from '@grafana/runtime';
import { iamAPIv0alpha1, type UserPermissions } from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { dispatch } from 'app/store/store';
import { type UserPermission } from 'app/types/accessControl';

/**
 * Loads the current user's effective permissions from the multi-tenant AuthZ
 * user-permissions API as an action-keyed lookup map. Isolated here so the
 * underlying API can be swapped without touching callers.
 */
export async function loadUserPermissions(): Promise<UserPermission | null> {
  try {
    const { permissions }: UserPermissions = await dispatch(
      iamAPIv0alpha1.endpoints.getCurrentUserPermissions.initiate(undefined, { subscribe: false })
    ).unwrap();

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
