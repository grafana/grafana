import React, { memo, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { StoreState, ServiceAccountDTO, AccessControlAction, Role } from 'app/types';
import { loadServiceAccounts, removeServiceAccount, updateServiceAccount } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServiceAccounts, getServiceAccountsSearchPage, getServiceAccountsSearchQuery } from './state/selectors';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { fetchBuiltinRoles, fetchRoleOptions } from 'app/core/components/RolePicker/api';
export type Props = ConnectedProps<typeof connector>;

export interface State {}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccounts: getServiceAccounts(state.serviceAccounts),
    searchQuery: getServiceAccountsSearchQuery(state.serviceAccounts),
    searchPage: getServiceAccountsSearchPage(state.serviceAccounts),
    isLoading: state.serviceAccounts.isLoading,
  };
}

const mapDispatchToProps = {
  loadServiceAccounts,
  updateServiceAccount,
  removeServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

const ServiceAccountsListPage: React.FC<Props> = ({ loadServiceAccounts, navModel, serviceAccounts, isLoading }) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadServiceAccounts();
  }, [loadServiceAccounts]);
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
                  {serviceAccounts.map((serviceaccount: ServiceAccountDTO) => (
                    <ServiceAccountListItem
                      serviceaccount={serviceaccount}
                      key={serviceaccount.id}
                      onRoleChange={() => {}}
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
  serviceaccount: ServiceAccountDTO;
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void;
};

const getServiceAccountsAriaLabel = (name: string) => {
  return `Edit service account's ${name} details`;
};

const ServiceAccountListItem = memo(({ serviceaccount, onRoleChange }: ServiceAccountListItemProps) => {
  const editUrl = `org/serviceaccounts/${serviceaccount.id}`;
  const styles = useStyles2(getStyles);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<Record<string, Role[]>>({});
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRoleUpdate, serviceaccount);
  const rolePickerDisabled = !canUpdateRole;

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(serviceaccount.orgId);
          setRoleOptions(options);
        }

        if (contextSrv.hasPermission(AccessControlAction.ActionBuiltinRolesList)) {
          const builtInRoles = await fetchBuiltinRoles(serviceaccount.orgId);
          setBuiltinRoles(builtInRoles);
        }
      } catch (e) {
        console.error('Error loading options');
      }
    }
    if (contextSrv.accessControlEnabled()) {
      fetchOptions();
    }
  }, [serviceaccount.orgId]);

  return (
    <tr key={serviceaccount.id}>
      <td className="width-4 text-center link-td">
        <a href={editUrl} aria-label={getServiceAccountsAriaLabel(serviceaccount.name)}>
          <img
            className="filter-table__avatar"
            src={serviceaccount.avatarUrl}
            alt={`Avatar for user ${serviceaccount.name}`}
          />
        </a>
      </td>
      <td className="link-td max-width-10">
        <a
          className="ellipsis"
          href={editUrl}
          title={serviceaccount.name}
          aria-label={getServiceAccountsAriaLabel(serviceaccount.name)}
        >
          {serviceaccount.name}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a
          className="ellipsis"
          href={editUrl}
          title={serviceaccount.login}
          aria-label={getServiceAccountsAriaLabel(serviceaccount.name)}
        >
          {serviceaccount.login}
        </a>
      </td>
      <td className={cx('link-td', styles.iconRow)}>
        <a
          className="ellipsis"
          href={editUrl}
          title={serviceaccount.name}
          aria-label={getServiceAccountsAriaLabel(serviceaccount.name)}
        >
          {contextSrv.licensedAccessControlEnabled() ? (
            <UserRolePicker
              userId={serviceaccount.id}
              orgId={serviceaccount.orgId}
              builtInRole={serviceaccount.role}
              onBuiltinRoleChange={(newRole) => onRoleChange(newRole, serviceaccount)}
              roleOptions={roleOptions}
              builtInRoles={builtinRoles}
              disabled={rolePickerDisabled}
            />
          ) : (
            <OrgRolePicker
              aria-label="Role"
              value={serviceaccount.role}
              disabled={!canUpdateRole}
              onChange={(newRole) => onRoleChange(newRole, serviceaccount)}
            />
          )}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a
          className="ellipsis"
          href={editUrl}
          title="tokens"
          aria-label={getServiceAccountsAriaLabel(serviceaccount.name)}
        >
          <span>
            <Icon name={'key-skeleton-alt'}></Icon>
          </span>
          {serviceaccount.tokens}
        </a>
      </td>
    </tr>
  );
});
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
