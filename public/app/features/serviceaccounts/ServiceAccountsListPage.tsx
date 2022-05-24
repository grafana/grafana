import { css, cx } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { ConfirmModal, FilterInput, LinkButton, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState, ServiceAccountDTO, AccessControlAction } from 'app/types';

import ServiceAccountListItem from './ServiceAccountsListItem';
import {
  changeFilter,
  changeQuery,
  fetchACOptions,
  fetchServiceAccounts,
  removeServiceAccount,
  updateServiceAccount,
  setServiceAccountToRemove,
} from './state/actions';

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
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const fetchData = async () => {
      await fetchServiceAccounts();
      if (contextSrv.licensedAccessControlEnabled()) {
        await fetchACOptions();
      }
    };
    fetchData();
  }, [fetchServiceAccounts, fetchACOptions]);

  const onRoleChange = async (role: OrgRole, serviceAccount: ServiceAccountDTO) => {
    const updatedServiceAccount = { ...serviceAccount, role: role };
    await updateServiceAccount(updatedServiceAccount);
    // need to refetch to display the new value in the list
    await fetchServiceAccounts();
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchACOptions();
    }
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
            onChange={(value) => changeFilter({ name: 'expiredTokens', value })}
            value={filters.find((f) => f.name === 'expiredTokens')?.value}
            className={styles.filter}
          />
          {serviceAccounts.length !== 0 && contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate) && (
            <LinkButton href="org/serviceaccounts/create" variant="primary">
              Add service account
            </LinkButton>
          )}
        </div>
        {isLoading && <PageLoader />}
        {!isLoading && serviceAccounts.length === 0 && (
          <>
            <EmptyListCTA
              title="You haven't created any service accounts yet."
              buttonIcon="key-skeleton-alt"
              buttonLink="org/serviceaccounts/create"
              buttonTitle="Add service account"
              buttonDisabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate)}
              proTip="Remember, you can provide specific permissions for API access to other applications."
              proTipLink=""
              proTipLinkTitle=""
              proTipTarget="_blank"
            />
          </>
        )}
        {!isLoading && serviceAccounts.length !== 0 && (
          <>
            <div className={cx(styles.table, 'admin-list-table')}>
              <table className="filter-table form-inline filter-table--hover">
                <thead>
                  <tr>
                    <th></th>
                    <th>Account</th>
                    <th>ID</th>
                    <th>Roles</th>
                    <th>Status</th>
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

export const getStyles = (theme: GrafanaTheme2) => {
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
