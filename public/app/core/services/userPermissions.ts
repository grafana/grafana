import { logError } from '@grafana/runtime';
import { iamAPIv0alpha1, type UserPermissions } from 'app/api/clients/iam/v0alpha1';
import { dispatch } from 'app/store/store';
import { type UserPermission } from 'app/types/accessControl';

/**
 * Loads the current user's effective permissions from the multi-tenant AuthZ
 * user-permissions API as an action-keyed lookup map. Isolated here so the
 * underlying API can be swapped without touching callers.
 *
 * Goes through the RTK Query client so the result is cached and shared with any
 * later useGetCurrentUserPermissionsQuery consumers.
 */
export async function loadUserPermissions(): Promise<UserPermission> {
  try {
    const { permissions }: UserPermissions = await dispatch(
      iamAPIv0alpha1.endpoints.getCurrentUserPermissions.initiate(undefined, { subscribe: false })
    ).unwrap();

    return permissions.reduce<UserPermission>((acc, { action }) => {
      acc[action] = true;
      return acc;
    }, {});
  } catch (error) {
    logError(error instanceof Error ? error : new Error('Failed to load user permissions'));
    return {};
  }
}
