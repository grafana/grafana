import { css, cx } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Button, ConfirmButton, HorizontalGroup, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role, ServiceAccountDTO } from 'app/types';

import { OrgRolePicker } from '../admin/OrgRolePicker';

type ServiceAccountListItemProps = {
  serviceAccount: ServiceAccountDTO;
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void;
  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
  onSetToRemove: (serviceAccount: ServiceAccountDTO) => void;
  onDisable: (serviceAccount: ServiceAccountDTO) => void;
  onEnable: (serviceAccount: ServiceAccountDTO) => void;
};

const getServiceAccountsAriaLabel = (name: string) => {
  return `Edit service account's ${name} details`;
};

const ServiceAccountListItem = memo(
  ({
    serviceAccount,
    onRoleChange,
    roleOptions,
    builtInRoles,
    onSetToRemove,
    onDisable,
    onEnable,
  }: ServiceAccountListItemProps) => {
    const editUrl = `org/serviceaccounts/${serviceAccount.id}`;
    const styles = useStyles2(getStyles);
    const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
    const displayRolePicker =
      contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
    const enableRolePicker = contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate) && canUpdateRole;

    return (
      <tr key={serviceAccount.id}>
        <td className="width-4 text-center link-td">
          <a href={editUrl} aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}>
            <img
              className="filter-table__avatar"
              src={serviceAccount.avatarUrl}
              alt={`Avatar for user ${serviceAccount.name}`}
            />
          </a>
        </td>
        <td className="link-td max-width-10">
          <a
            className="ellipsis"
            href={editUrl}
            title={serviceAccount.name}
            aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}
          >
            {serviceAccount.name}
          </a>
        </td>
        <td className="link-td max-width-10">
          <a
            className={styles.accountId}
            href={editUrl}
            title={serviceAccount.login}
            aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}
          >
            {serviceAccount.login}
          </a>
        </td>
        {contextSrv.licensedAccessControlEnabled() ? (
          <td className={cx('link-td', styles.iconRow)}>
            {displayRolePicker && (
              <UserRolePicker
                userId={serviceAccount.id}
                orgId={serviceAccount.orgId}
                builtInRole={serviceAccount.role}
                onBuiltinRoleChange={(newRole) => onRoleChange(newRole, serviceAccount)}
                roleOptions={roleOptions}
                builtInRoles={builtInRoles}
                disabled={!enableRolePicker}
              />
            )}
          </td>
        ) : (
          <td className={cx('link-td', styles.iconRow)}>
            <OrgRolePicker
              aria-label="Role"
              value={serviceAccount.role}
              disabled={!canUpdateRole}
              onChange={(newRole) => onRoleChange(newRole, serviceAccount)}
            />
          </td>
        )}
        <td className="link-td max-width-10">
          <a
            className="ellipsis"
            href={editUrl}
            title="Tokens"
            aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}
          >
            <span>
              <Icon name={'key-skeleton-alt'}></Icon>
            </span>
            &nbsp;
            {serviceAccount.tokens}
          </a>
        </td>
        {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, serviceAccount) && (
          <td>
            <HorizontalGroup>
              {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, serviceAccount) &&
                (serviceAccount.isDisabled ? (
                  <Button variant="primary" onClick={() => onEnable(serviceAccount)}>
                    Enable
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => onDisable(serviceAccount)}>
                    Disable
                  </Button>
                ))}
              <ConfirmButton
                size="sm"
                onConfirm={() => {
                  onSetToRemove(serviceAccount);
                }}
                aria-label="Delete service account"
                confirmText="Delete"
                confirmVariant="destructive"
              >
                <IconButton className={styles.deleteButton} name="trash-alt" size="sm" />
              </ConfirmButton>
            </HorizontalGroup>
          </td>
        )}
      </tr>
    );
  }
);
ServiceAccountListItem.displayName = 'ServiceAccountListItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconRow: css`
      svg {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    accountId: cx(
      'ellipsis',
      css`
        color: ${theme.colors.text.secondary};
      `
    ),
    deleteButton: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};

export default ServiceAccountListItem;
