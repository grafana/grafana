import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { Role, OrgRole } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchBuiltinRoles, fetchRoleOptions, fetchUserRoles, updateUserRoles } from './api';

export interface Props {
  builtInRole: OrgRole;
  userId: number;
  orgId?: number;
  onBuiltinRoleChange: (newRole: OrgRole) => void;
  getRoleOptions?: () => Promise<Role[]>;
  getBuiltinRoles?: () => Promise<{ [key: string]: Role[] }>;
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const UserRolePicker: FC<Props> = ({
  builtInRole,
  userId,
  orgId,
  onBuiltinRoleChange,
  getRoleOptions,
  getBuiltinRoles,
  disabled,
  builtinRolesDisabled,
}) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [appliedRoles, setAppliedRoles] = useState<Role[]>([]);
  const [builtInRoles, setBuiltinRoles] = useState<Record<string, Role[]>>({});

  const { loading } = useAsync(async () => {
    try {
      let options = await (getRoleOptions ? getRoleOptions() : fetchRoleOptions(orgId));
      setRoleOptions(options.filter((option) => !option.name?.startsWith('managed:')));

      const builtInRoles = await (getBuiltinRoles ? getBuiltinRoles() : fetchBuiltinRoles(orgId));
      setBuiltinRoles(builtInRoles);

      const userRoles = await fetchUserRoles(userId, orgId);
      setAppliedRoles(userRoles);
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
  }, [getBuiltinRoles, getRoleOptions, orgId, userId]);

  return (
    <RolePicker
      builtInRole={builtInRole}
      onRolesChange={(roles) => updateUserRoles(roles, userId, orgId)}
      onBuiltinRoleChange={onBuiltinRoleChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      builtInRoles={builtInRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
      showBuiltInRole
    />
  );
};
