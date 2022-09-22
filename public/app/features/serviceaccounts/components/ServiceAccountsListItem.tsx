import { css, cx } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Button, HorizontalGroup, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { OrgRolePicker } from 'app/features/admin/OrgRolePicker';
import { AccessControlAction, Role, ServiceAccountDTO } from 'app/types';

type ServiceAccountListItemProps = {
  serviceAccount: ServiceAccountDTO;
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void;
  roleOptions: Role[];
  onRemoveButtonClick: (serviceAccount: ServiceAccountDTO) => void;
  onDisable: (serviceAccount: ServiceAccountDTO) => void;
  onEnable: (serviceAccount: ServiceAccountDTO) => void;
  onAddTokenClick: (serviceAccount: ServiceAccountDTO) => void;
};

const getServiceAccountsAriaLabel = (name: string) => {
  return `Edit service account's ${name} details`;
};

const ServiceAccountListItem = memo(
  ({
    serviceAccount,
    onRoleChange,
    roleOptions,
    onRemoveButtonClick,
    onDisable,
    onEnable,
    onAddTokenClick,
  }: ServiceAccountListItemProps) => {
    const editUrl = `org/serviceaccounts/${serviceAccount.id}`;
    const styles = useStyles2(getStyles);
    const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
    const displayRolePicker =
      contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);

    return (
      <tr key={serviceAccount.id} className={cx({ [styles.disabled]: serviceAccount.isDisabled })}>
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
          <td>
            {displayRolePicker && (
              <UserRolePicker
                userId={serviceAccount.id}
                orgId={serviceAccount.orgId}
                basicRole={serviceAccount.role}
                onBasicRoleChange={(newRole) => onRoleChange(newRole, serviceAccount)}
                roleOptions={roleOptions}
                basicRoleDisabled={!canUpdateRole}
                disabled={serviceAccount.isDisabled}
              />
            )}
          </td>
        ) : (
          <td>
            <OrgRolePicker
              aria-label="Role"
              value={serviceAccount.role}
              disabled={!canUpdateRole || serviceAccount.isDisabled}
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
            <div className={cx(styles.tokensInfo, { [styles.tokensInfoSecondary]: !serviceAccount.tokens })}>
              <span>
                <Icon name="key-skeleton-alt"></Icon>
              </span>
              {serviceAccount.tokens || 'No tokens'}
            </div>
          </a>
        </td>
        <td>
          <HorizontalGroup justify="flex-end">
            {contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) && !serviceAccount.tokens && (
              <Button onClick={() => onAddTokenClick(serviceAccount)} disabled={serviceAccount.isDisabled}>
                Add token
              </Button>
            )}
            {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount) &&
              (serviceAccount.isDisabled ? (
                <Button variant="primary" onClick={() => onEnable(serviceAccount)}>
                  Enable
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => onDisable(serviceAccount)}>
                  Disable
                </Button>
              ))}
            {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, serviceAccount) && (
              <IconButton
                className={styles.deleteButton}
                name="trash-alt"
                size="md"
                onClick={() => onRemoveButtonClick(serviceAccount)}
                aria-label={`Delete service account ${serviceAccount.name}`}
              />
            )}
          </HorizontalGroup>
        </td>
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
    tokensInfo: css`
      span {
        margin-right: ${theme.spacing(1)};
      }
    `,
    tokensInfoSecondary: css`
      color: ${theme.colors.text.secondary};
    `,
    disabled: css`
      td a {
        color: ${theme.colors.text.secondary};
      }
    `,
  };
};

export default ServiceAccountListItem;
