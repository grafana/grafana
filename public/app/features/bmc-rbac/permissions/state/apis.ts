import { getBackendSrv } from '@grafana/runtime';

import { Permission } from './types';

const backend = getBackendSrv();

export const getPermissions = async (roleId: number) => {
  const url = `/api/rbac/roles/${roleId}/permissions`;
  return await backend.get(url);
};

export const updatePermissions = async (role: any, data: Permission[]) => {
  if (role.systemRole) {
    return;
  }
  // get only the permissions that true and send them to the backend
  const permissions = data.filter((permission) => permission.status).map((permission) => permission.name);
  const url = `/api/rbac/roles/${role.id}/permissions`;
  await backend.post(url, { permissions });
};
