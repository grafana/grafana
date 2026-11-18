import { type ComponentType, useEffect } from 'react';
import { connect, type ConnectedProps } from 'react-redux';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, RadioButtonGroup, useStyles2, FilterInput, EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState } from 'app/types/store';
import { type UserFilter } from 'app/types/user';

import { EnterpriseAuthFeaturesCard } from './EnterpriseAuthFeaturesCard';
import { UsersTable } from './Users/UsersTable';
import { getToolbarStyles } from './Users/getToolbarStyles';
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
  const styles = useStyles2(getToolbarStyles);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Page.Contents>
      <div className={styles.toolbar} data-testid={selectors.container}>
        <FilterInput
          className={styles.search}
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
          <FilterComponent key={index} filters={filters} onChange={changeFilter} className={styles.extraFilter} />
        ))}
        {contextSrv.hasPermission(AccessControlAction.UsersCreate) && (
          <LinkButton href="admin/users/create" variant="primary">
            <Trans i18nKey="admin.users-list.create-button">New user</Trans>
          </LinkButton>
        )}
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
