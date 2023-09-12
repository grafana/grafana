import { css } from '@emotion/css';
import React, { ComponentType, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { LinkButton, RadioButtonGroup, useStyles2, FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';

import PageLoader from '../../core/components/PageLoader/PageLoader';
import { AccessControlAction, StoreState, UserFilter } from '../../types';

import { UsersTable } from './Users/UsersTable';
import { changeFilter, changePage, changeQuery, fetchUsers } from './state/actions';

export interface FilterProps {
  filters: UserFilter[];
  onChange: (filter: UserFilter) => void;
  className?: string;
}
const extraFilters: Array<ComponentType<FilterProps>> = [];
export const addExtraFilters = (filter: ComponentType<FilterProps>) => {
  extraFilters.push(filter);
};

const selectors = e2eSelectors.pages.UserListPage.UserListAdminPage;

const mapDispatchToProps = {
  fetchUsers,
  changeQuery,
  changePage,
  changeFilter,
};

const mapStateToProps = (state: StoreState) => ({
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  perPage: state.userListAdmin.perPage,
  filters: state.userListAdmin.filters,
  isLoading: state.userListAdmin.isLoading,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAdminPageUnConnected = ({
  fetchUsers,
  query,
  changeQuery,
  users,
  showPaging,
  perPage,
  changeFilter,
  filters,
  isLoading,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Page.Contents>
      <div className={styles.actionBar} data-testid={selectors.container}>
        <div className={styles.row}>
          <FilterInput
            placeholder="Search user by login, email, or name."
            autoFocus={true}
            value={query}
            onChange={changeQuery}
          />
          <RadioButtonGroup
            options={[
              { label: 'All users', value: false },
              { label: 'Active last 30 days', value: true },
            ]}
            onChange={(value) => changeFilter({ name: 'activeLast30Days', value })}
            value={filters.find((f) => f.name === 'activeLast30Days')?.value}
            className={styles.filter}
          />
          {extraFilters.map((FilterComponent, index) => (
            <FilterComponent key={index} filters={filters} onChange={changeFilter} className={styles.filter} />
          ))}
        </div>
        {contextSrv.hasPermission(AccessControlAction.UsersCreate) && (
          <LinkButton href="admin/users/create" variant="primary">
            New user
          </LinkButton>
        )}
      </div>
      {isLoading ? <PageLoader /> : <UsersTable users={users} showPaging={showPaging} perPage={perPage} />}
    </Page.Contents>
  );
};

export const UserListAdminPageContent = connector(UserListAdminPageUnConnected);

export function UserListAdminPage() {
  return (
    <Page navId="global-users">
      <UserListAdminPageContent />
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    filter: css`
      margin: 0 ${theme.spacing(1)};
    `,
    actionBar: css`
      margin-bottom: ${theme.spacing(2)};
      display: flex;
      align-items: flex-start;
      gap: ${theme.spacing(2)};

      ${theme.breakpoints.down('sm')} {
        flex-wrap: wrap;
      }
    `,
    row: css`
      display: flex;
      align-items: flex-start;
      text-align: left;
      margin-bottom: ${theme.spacing(0.5)};
      flex-grow: 1;

      ${theme.breakpoints.down('sm')} {
        flex-wrap: wrap;
        gap: ${theme.spacing(2)};
      }
    `,
  };
};

export default UserListAdminPage;
