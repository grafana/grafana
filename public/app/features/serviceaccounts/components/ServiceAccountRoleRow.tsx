import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
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
  const styles = useStyles2(getStyles);
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
  const rolePickerDisabled = !canUpdateRole || serviceAccount.isDisabled;

  return (
    <tr>
      <td className={styles.label}>
        <label htmlFor={inputId}>{label}</label>
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
          <td className="width-16">
            <OrgRolePicker
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

const getStyles = (theme: GrafanaTheme2) => ({
  label: cx(
    'width-16',
    css`
      font-weight: 500;
    `
  ),
});
