import { act } from '@testing-library/react';

import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions } from '../mocks';
import { setFolderAccessControl } from '../mocks/server/configure';

/**
 * Flushes out microtasks so we don't get warnings from `@floating-ui/react`
 * as per https://floating-ui.com/docs/react#testing
 */
export const flushMicrotasks = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/**
 * "Grants" permissions via contextSrv mock, and additionally sets folder access control
 * API response to match
 */
export const grantPermissionsHelper = (permissions: AccessControlAction[]) => {
  const permissionsHash = permissions.reduce((hash, permission) => ({ ...hash, [permission]: true }), {});
  grantUserPermissions(permissions);
  setFolderAccessControl(permissionsHash);
};
