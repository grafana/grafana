import React, { memo, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { StoreState, ServiceAccountDTO, AccessControlAction, Role } from 'app/types';
import { fetchACOptions, loadServiceAccounts, removeServiceAccount, updateServiceAccount } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServiceAccounts, getServiceAccountsSearchPage, getServiceAccountsSearchQuery } from './state/selectors';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { OrgRolePicker } from '../admin/OrgRolePicker';
export type Props = ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccounts: getServiceAccounts(state.serviceAccounts),
    searchQuery: getServiceAccountsSearchQuery(state.serviceAccounts),
    searchPage: getServiceAccountsSearchPage(state.serviceAccounts),
    isLoading: state.serviceAccounts.isLoading,
    roleOptions: state.serviceAccounts.roleOptions,
    builtInRoles: state.serviceAccounts.builtInRoles,
  };
}

const mapDispatchToProps = {
  loadServiceAccounts,
  fetchACOptions,
  updateServiceAccount,
  removeServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

const ServiceAccountsListPage = ({
  loadServiceAccounts,
  fetchACOptions,
  updateServiceAccount,
  navModel,
  serviceAccounts,
  isLoading,
  roleOptions,
  builtInRoles,
}: Props) => {
  const styles = useStyles2(getStyles);
  useEffect(() => {
    loadServiceAccounts();
    if (contextSrv.accessControlEnabled()) {
      fetchACOptions();
    }
  }, [loadServiceAccounts, fetchACOptions]);

  const onRoleChange = (role: OrgRole, serviceAccount: ServiceAccountDTO) => {
    const updatedServiceAccount = { ...serviceAccount, role: role };

    updateServiceAccount(updatedServiceAccount);
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h2>Service accounts</h2>
        <div className="page-action-bar" style={{ justifyContent: 'flex-end' }}>
          {contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate) && (
            <LinkButton href="org/serviceaccounts/create" variant="primary">
              New service account
            </LinkButton>
          )}
        </div>
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            <div className={cx(styles.table, 'admin-list-table')}>
              <table className="filter-table form-inline filter-table--hover">
                <thead>
                  <tr>
                    <th></th>
                    <th>Display name</th>
                    <th>ID</th>
                    <th>Roles</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceAccounts.map((serviceAccount: ServiceAccountDTO) => (
                    <ServiceAccountListItem
                      serviceAccount={serviceAccount}
                      key={serviceAccount.id}
                      builtInRoles={builtInRoles}
                      roleOptions={roleOptions}
                      onRoleChange={onRoleChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

type ServiceAccountListItemProps = {
  serviceAccount: ServiceAccountDTO;
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void;
  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
};

const getServiceAccountsAriaLabel = (name: string) => {
  return `Edit service account's ${name} details`;
};

const ServiceAccountListItem = memo(
  ({ serviceAccount, onRoleChange, roleOptions, builtInRoles }: ServiceAccountListItemProps) => {
    const editUrl = `org/serviceAccounts/${serviceAccount.id}`;
    const styles = useStyles2(getStyles);
    const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
    const rolePickerDisabled = !canUpdateRole;

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
            className="ellipsis"
            href={editUrl}
            title={serviceAccount.login}
            aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}
          >
            {serviceAccount.login}
          </a>
        </td>
        <td className={cx('link-td', styles.iconRow)}>
          {contextSrv.licensedAccessControlEnabled() ? (
            <UserRolePicker
              userId={serviceAccount.id}
              orgId={serviceAccount.orgId}
              builtInRole={serviceAccount.role}
              onBuiltinRoleChange={(newRole) => onRoleChange(newRole, serviceAccount)}
              roleOptions={roleOptions}
              builtInRoles={builtInRoles}
              disabled={rolePickerDisabled}
            />
          ) : (
            <OrgRolePicker
              aria-label="Role"
              value={serviceAccount.role}
              disabled={!canUpdateRole}
              onChange={(newRole) => onRoleChange(newRole, serviceAccount)}
            />
          )}
        </td>
        <td className="link-td max-width-10">
          <a
            className="ellipsis"
            href={editUrl}
            title="tokens"
            aria-label={getServiceAccountsAriaLabel(serviceAccount.name)}
          >
            <span>
              <Icon name={'key-skeleton-alt'}></Icon>
            </span>
            {serviceAccount.tokens}
          </a>
        </td>
      </tr>
    );
  }
);
ServiceAccountListItem.displayName = 'ServiceAccountListItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    table: css`
      margin-top: ${theme.spacing(3)};
    `,
    filter: css`
      margin: 0 ${theme.spacing(1)};
    `,
    iconRow: css`
      svg {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    row: css`
      display: flex;
      align-items: center;
      height: 100% !important;

      a {
        padding: ${theme.spacing(0.5)} 0 !important;
      }
    `,
    unitTooltip: css`
      display: flex;
      flex-direction: column;
    `,
    unitItem: css`
      cursor: pointer;
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};
    `,
    disabled: css`
      color: ${theme.colors.text.disabled};
    `,
    link: css`
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
  };
};

export default connector(ServiceAccountsListPage);
