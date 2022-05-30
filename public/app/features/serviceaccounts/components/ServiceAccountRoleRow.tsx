import React from 'react';

import { Label } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { OrgRolePicker } from 'app/features/admin/OrgRolePicker';
import { AccessControlAction, OrgRole, Role, ServiceAccountDTO } from 'app/types';

interface Props {
  label: string;
  serviceAccount: ServiceAccountDTO;
  onRoleChange: (role: OrgRole) => void;
  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
}

export const ServiceAccountRoleRow = ({
  label,
  serviceAccount,
  roleOptions,
  builtInRoles,
  onRoleChange,
}: Props): JSX.Element => {
  const inputId = `${label}-input`;
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
  const rolePickerDisabled = !canUpdateRole || serviceAccount.isDisabled;

  return (
    <tr>
      <td>
        <Label htmlFor={inputId}>{label}</Label>
      </td>
      {contextSrv.licensedAccessControlEnabled() ? (
        <td className="width-25" colSpan={3}>
          <UserRolePicker
            userId={serviceAccount.id}
            orgId={serviceAccount.orgId}
            builtInRole={serviceAccount.role}
            onBuiltinRoleChange={onRoleChange}
            roleOptions={roleOptions}
            builtInRoles={builtInRoles}
            disabled={rolePickerDisabled}
          />
        </td>
      ) : (
        <>
          <td>
            <OrgRolePicker
              width={24}
              inputId={inputId}
              aria-label="Role"
              value={serviceAccount.role}
              disabled={rolePickerDisabled}
              onChange={onRoleChange}
            />
          </td>
          <td colSpan={2}></td>
        </>
      )}
    </tr>
  );
};
