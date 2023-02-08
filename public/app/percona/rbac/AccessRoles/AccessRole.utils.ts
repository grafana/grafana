import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

import { AccessRoleRow } from './AccessRole.types';

export const toAccessRoleRow = (role: AccessRole, roleId?: number): AccessRoleRow => ({
  ...role,
  isDefault: role.roleId === roleId,
});

export const orderRole = (a: AccessRoleRow, b: AccessRoleRow) => {
  if (a.isDefault) {
    return -1;
  }

  if (b.isDefault) {
    return 1;
  }

  return a.title.localeCompare(b.title);
};
