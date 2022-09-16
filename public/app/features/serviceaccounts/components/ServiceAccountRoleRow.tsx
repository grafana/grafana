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
}

export const ServiceAccountRoleRow = ({ label, serviceAccount, roleOptions, onRoleChange }: Props): JSX.Element => {
  const inputId = `${label}-input`;
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);

  return (
    <tr>
      <td>
        <Label htmlFor={inputId}>{label}</Label>
      </td>
      {contextSrv.licensedAccessControlEnabled() ? (
        <td colSpan={3}>
          <UserRolePicker
            userId={serviceAccount.id}
            orgId={serviceAccount.orgId}
            basicRole={serviceAccount.role}
            onBasicRoleChange={onRoleChange}
            roleOptions={roleOptions}
            basicRoleDisabled={!canUpdateRole}
            disabled={serviceAccount.isDisabled}
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
              disabled={serviceAccount.isDisabled}
              onChange={onRoleChange}
            />
          </td>
          <td colSpan={2}></td>
        </>
      )}
    </tr>
  );
};
