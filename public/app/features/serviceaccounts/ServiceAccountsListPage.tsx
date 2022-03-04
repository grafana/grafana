import React, { memo, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Button, ConfirmModal, FilterInput, Icon, LinkButton, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { StoreState, ServiceAccountDTO, AccessControlAction, Role } from 'app/types';
import {
  changeFilter,
  changeQuery,
  fetchACOptions,
  fetchServiceAccounts,
  removeServiceAccount,
  updateServiceAccount,
  setServiceAccountToRemove,
} from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import pluralize from 'pluralize';

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    ...state.serviceAccounts,
  };
}

const mapDispatchToProps = {
  fetchServiceAccounts,
  fetchACOptions,
  updateServiceAccount,
  removeServiceAccount,
  setServiceAccountToRemove,
  changeFilter,
  changeQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

const ServiceAccountsListPage = ({
  fetchServiceAccounts,
  removeServiceAccount,
  fetchACOptions,
  updateServiceAccount,
  setServiceAccountToRemove,
  navModel,
  serviceAccounts,
  isLoading,
  roleOptions,
  builtInRoles,
  changeFilter,
  changeQuery,
  query,
  filters,
  serviceAccountToRemove,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchServiceAccounts();
    if (contextSrv.accessControlEnabled()) {
      fetchACOptions();
    }
  }, [fetchServiceAccounts, fetchACOptions]);

  const onRoleChange = (role: OrgRole, serviceAccount: ServiceAccountDTO) => {
    const updatedServiceAccount = { ...serviceAccount, role: role };
    updateServiceAccount(updatedServiceAccount);
  };
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h2>Service accounts</h2>
        <div className="page-action-bar" style={{ justifyContent: 'flex-end' }}>
          <FilterInput
            placeholder="Search service account by name."
            autoFocus={true}
            value={query}
            onChange={changeQuery}
          />
          <RadioButtonGroup
            options={[
              { label: 'All service accounts', value: false },
              { label: 'Expired tokens', value: true },
            ]}
            onChange={(value) => changeFilter({ name: 'Expired', value })}
            value={filters.find((f) => f.name === 'Expired')?.value}
            className={styles.filter}
          />
        </div>
        {contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate) && (
          <LinkButton href="org/serviceaccounts/create" variant="primary">
            New service account
          </LinkButton>
        )}
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
                    <th style={{ width: '34px' }} />
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
                      onSetToRemove={setServiceAccountToRemove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {serviceAccountToRemove && (
          <ConfirmModal
            body={
              <div>
                Are you sure you want to delete &apos;{serviceAccountToRemove.name}&apos;
                {Boolean(serviceAccountToRemove.tokens) &&
                  ` and ${serviceAccountToRemove.tokens} accompanying ${pluralize(
                    'token',
                    serviceAccountToRemove.tokens
                  )}`}
                ?
              </div>
            }
            confirmText="Delete"
            title="Delete service account"
            onDismiss={() => {
              setServiceAccountToRemove(null);
            }}
            isOpen={true}
            onConfirm={() => {
              removeServiceAccount(serviceAccountToRemove.id);
              setServiceAccountToRemove(null);
            }}
          />
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
  onSetToRemove: (serviceAccount: ServiceAccountDTO) => void;
};

const getServiceAccountsAriaLabel = (name: string) => {
  return `Edit service account's ${name} details`;
};

const ServiceAccountListItem = memo(
  ({ serviceAccount, onRoleChange, roleOptions, builtInRoles, onSetToRemove }: ServiceAccountListItemProps) => {
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
        {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, serviceAccount) && (
          <td>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onSetToRemove(serviceAccount);
              }}
              icon="times"
              aria-label="Delete service account"
            />
          </td>
        )}
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
