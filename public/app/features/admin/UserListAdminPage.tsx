import { css } from '@emotion/css';
import { ComponentType, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, RadioButtonGroup, useStyles2, FilterInput, EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { StoreState } from 'app/types/store';
import { UserFilter } from 'app/types/user';

import { EnterpriseAuthFeaturesCard } from './EnterpriseAuthFeaturesCard';
import { UsersTable } from './Users/UsersTable';
import { changeFilter, changePage, changeQuery, changeSort, fetchUsers } from './state/actions';

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
  changeSort,
};

const mapStateToProps = (state: StoreState) => ({
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  totalPages: state.userListAdmin.totalPages,
  page: state.userListAdmin.page,
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
  changeFilter,
  filters,
  totalPages,
  page,
  changePage,
  changeSort,
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
            placeholder={t(
              'admin.user-list-admin-page-un-connected.placeholder-search-login-email',
              'Search user by login, email, or name.'
            )}
            autoFocus={true}
            value={query}
            onChange={changeQuery}
            escapeRegex={false}
          />
          <RadioButtonGroup
            options={[
              { label: t('admin.user-list-admin-page-un-connected.label.all-users', 'All users'), value: false },
              {
                label: t('admin.user-list-admin-page-un-connected.label.active-last-days', 'Active last 30 days'),
                value: true,
              },
            ]}
            onChange={(value) => changeFilter({ name: 'activeLast30Days', value })}
            value={filters.find((f) => f.name === 'activeLast30Days')?.value}
            className={styles.filter}
          />
          {extraFilters.map((FilterComponent, index) => (
            <FilterComponent key={index} filters={filters} onChange={changeFilter} className={styles.filter} />
          ))}
          {contextSrv.hasPermission(AccessControlAction.UsersCreate) && (
            <LinkButton href="admin/users/create" variant="primary">
              <Trans i18nKey="admin.users-list.create-button">New user</Trans>
            </LinkButton>
          )}
        </div>
      </div>
      {!isLoading && users.length === 0 ? (
        <EmptyState message={t('users.empty-state.message', 'No users found')} variant="not-found" />
      ) : (
        <UsersTable
          users={users}
          showPaging={showPaging}
          totalPages={totalPages}
          onChangePage={changePage}
          currentPage={page}
          fetchData={changeSort}
        />
      )}
      <EnterpriseAuthFeaturesCard page="users" />
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
    filter: css({
      margin: theme.spacing(0, 1),
      [theme.breakpoints.down('sm')]: {
        margin: 0,
      },
    }),
    actionBar: css({
      marginBottom: theme.spacing(2),
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
      },
    }),
    row: css({
      display: 'flex',
      alignItems: 'flex-start',
      textAlign: 'left',
      marginBottom: theme.spacing(0.5),
      flexGrow: 1,

      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        width: '100%',
      },
    }),
  };
};

export default UserListAdminPage;
