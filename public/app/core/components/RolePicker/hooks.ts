import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types';

import { fetchRoleOptions } from './api';

interface MultiOrgRoleOptions {
  /** Object where keys are orgIDs */
  roleOptions: Record<number, Role[]>;
}

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

export const useMultiOrgRoleOptions = (ids: number[]): MultiOrgRoleOptions => {
  const [orgIDs, _] = useState(ids); // TODO(aarongodin): pass back the state setter here?
  const { value = [] } = useAsync(async () => {
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return Promise.all(
        orgIDs.map((orgID) => {
          return fetchRoleOptions(orgID).then((roleOptions) => [orgID, roleOptions]);
        })
      );
    }
    return Promise.resolve([]);
  }, [orgIDs]);
  return {
    roleOptions: Object.fromEntries(value),
  };
};
