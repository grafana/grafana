import { useEffect, useState } from 'react';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types';

import { fetchRoleOptions } from './api';

export const useRoleOptions = (organizationId: number) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [orgId, setOrgId] = useState<number>(organizationId);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const options = await fetchRoleOptions(orgId);
        setRoleOptions(options);
      } catch (e) {
        console.error('Error loading Role options', e);
      }
    }
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      fetchOptions();
    }
  }, [orgId]);

  return [{ roleOptions }, setOrgId] as const;
};
