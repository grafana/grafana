import { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

import { canManageGlobalVariables } from './utils';

/**
 * Root/global variable access from scoped RBAC (writer / folders:uid:general),
 * not org Admin. Falls back to Admin until /user/permissions resolves.
 */
export function useCanManageGlobalVariables(): boolean {
  const [permissionScopes, setPermissionScopes] = useState<Record<string, string[]> | undefined>();

  useEffect(() => {
    let cancelled = false;
    getBackendSrv()
      .get<Record<string, string[]>>('/api/access-control/user/permissions')
      .then((permissions) => {
        if (!cancelled) {
          setPermissionScopes(permissions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionScopes({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return canManageGlobalVariables(permissionScopes);
}
