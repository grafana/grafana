import { difference } from 'lodash';
import { useState } from 'react';
import { useDeepCompareEffect } from 'react-use';
import useAsync from 'react-use/lib/useAsync';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types/accessControl';

import { fetchRoleOptions } from './api';

type MultiOrgRoleOptions = Record<number, Role[]>;

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

export const useMultiOrgRoleOptions = (orgIDs: number[]): MultiOrgRoleOptions => {
  const [orgRoleOptions, setOrgRoleOptions] = useState<MultiOrgRoleOptions>({});

  useDeepCompareEffect(() => {
    if (!contextSrv.licensedAccessControlEnabled() || !contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return;
    }

    const currentOrgIDs = Object.keys(orgRoleOptions).map((o) => (typeof o === 'number' ? o : parseInt(o, 10)));
    const newOrgIDs = difference(orgIDs, currentOrgIDs);

    Promise.all(
      newOrgIDs.map((orgID) => {
        return fetchRoleOptions(orgID).then((roleOptions) => [orgID, roleOptions]);
      })
    ).then((value) => {
      setOrgRoleOptions({
        ...orgRoleOptions,
        ...Object.fromEntries(value),
      });
    });
  }, [orgIDs]);

  return orgRoleOptions;
};
