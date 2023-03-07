import { SelectableValue } from '@grafana/data';
import { UserItem } from 'app/percona/shared/core/reducers/users/users.types';
import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';
import { OrgUser } from 'app/types';

import { DeleteRoleFormValues } from './DeleteRoleModal.types';

export const getOptions = (roles: AccessRole[], roleToDelete: AccessRole): SelectableValue[] =>
  roles.filter((role) => role.roleId !== roleToDelete.roleId).map(roleToOption);

export const roleToOption = (role: AccessRole): SelectableValue<number> => ({
  label: role.title,
  value: role.roleId,
});

export const getDefaultFormValues = (defaultRole?: AccessRole): DeleteRoleFormValues | undefined =>
  defaultRole
    ? {
        replacementRoleId: roleToOption(defaultRole),
      }
    : undefined;

export const isRoleAssigned = (role: AccessRole, usersInfo: UserItem[], users: OrgUser[]) =>
  usersInfo.some((u) => u.roleIds.includes(role.roleId) && users.some((orgUser) => orgUser.userId === u.userId));
