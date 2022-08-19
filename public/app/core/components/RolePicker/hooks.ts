import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

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
