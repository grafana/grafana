import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
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
  const styles = useStyles(getStyles);
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
  const rolePickerDisabled = !canUpdateRole || serviceAccount.isDisabled;

  return (
    <tr>
      <td className={styles.label}>
        <label htmlFor={inputId}>{label}</label>
      </td>
      <td className="width-25" colSpan={2}>
        {contextSrv.licensedAccessControlEnabled() ? (
          <UserRolePicker
            userId={serviceAccount.id}
            orgId={serviceAccount.orgId}
            builtInRole={serviceAccount.role}
            onBuiltinRoleChange={onRoleChange}
            roleOptions={roleOptions}
            builtInRoles={builtInRoles}
            disabled={rolePickerDisabled}
          />
        ) : (
          <OrgRolePicker
            aria-label="Role"
            value={serviceAccount.role}
            disabled={rolePickerDisabled}
            onChange={onRoleChange}
            // TODO: check if we actually need it since <UserRolePicker /> cannot be activated with htmlFor
            inputId={inputId}
          />
        )}
      </td>
    </tr>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  label: cx(
    'width-16',
    css`
      font-weight: 500;
    `
  ),
});
