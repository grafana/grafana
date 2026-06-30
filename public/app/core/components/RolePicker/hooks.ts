import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, type Role } from 'app/types/accessControl';

import { fetchRoleOptions } from './api';

export const useRoleOptions = (organizationId: number) => {
  const [orgId, setOrgId] = useState(organizationId);

  const { value = [] } = useAsync(async () => {
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return fetchRoleOptions(orgId);
    }
    return Promise.resolve([]);
  }, [orgId]);

  return [{ roleOptions: value }, setOrgId] as const;
};

/**
 * @lintignore Used by enterprise extensions that are excluded from Knip.
 */
export const useMultiOrgRoleOptions = (organizationIds: number[]) => {
  const orgIdsKey = Array.from(new Set(organizationIds))
    .sort((a, b) => a - b)
    .join(',');

  const { value = {} } = useAsync(async () => {
    if (!contextSrv.licensedAccessControlEnabled() || !contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return {};
    }

    const orgIds = orgIdsKey === '' ? [] : orgIdsKey.split(',').map(Number);
    const roleOptions: Record<number, Role[]> = {};
    await Promise.all(
      orgIds.map(async (orgId) => {
        roleOptions[orgId] = await fetchRoleOptions(orgId);
      })
    );

    return roleOptions;
  }, [orgIdsKey]);

  return value;
};
