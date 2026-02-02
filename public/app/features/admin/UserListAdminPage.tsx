import { css } from '@emotion/css';
import { ComponentType, useEffect, useState, useRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { LinkButton, RadioButtonGroup, useStyles2, FilterInput, EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';

import { AccessControlAction, StoreState, UserFilter } from '../../types';

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
  // BMC Code : Accessibility Change starts here.
  const [statusMessage, setStatusMessage] = useState('');
  const [pageButtons, setPageButtons] = useState<HTMLButtonElement[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  // BMC Code : Accessibility Change end here.

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // BMC Code : Accessibility Change starts here.
  useEffect(() => {
    if (isLoading) {
      setStatusMessage(t('users.loading', 'Loading users...'));
    } else if (users.length === 0) {
      setStatusMessage(t('users.empty-state.message', 'No users found'));
    } else {
      setStatusMessage(`${users.length} Results available`);
    }
  }, [isLoading, users, t]);

  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.focus();
    }
  }, [statusMessage]);

  useEffect(() => {
    // Find all pagination buttons after the component renders
    const buttons = Array.from(document.querySelectorAll('ol li button')) as HTMLButtonElement[];
    setPageButtons(buttons);
  }, [users, page, totalPages]);

  useEffect(() => {
    pageButtons.forEach((button) => {
      if (button.innerText) {
        button.setAttribute('aria-label', t('users.pagination.page', `${button.innerText}`));

        if (button.innerText === page.toString()) {
          button.setAttribute('aria-current', 'page');
        }
      }
    });
  }, [pageButtons, page, t]);
  // BMC Code : Accessibility Change ends here.

  return (
    <Page.Contents>
      <div className={styles.actionBar} data-testid={selectors.container}>
        <div className={styles.row}>
          {
            //BMC Code : Accessibility Change (Next line, Added a label for FilterInput)
          }
          <label htmlFor="user-serach-filter-input" className={styles.hiddenLabel}>
            Search user by login, email, or name{' '}
          </label>
          {
            //BMC Code : Accessibility Change | Added id attribute to bind it to label element
          }
          <FilterInput
            placeholder="Search user by login, email, or name."
            id="user-serach-filter-input"
            autoFocus={true}
            value={query}
            onChange={changeQuery}
            escapeRegex={false}
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
          {/* BMC Code */}
          {contextSrv.hasPermission(AccessControlAction.UsersCreate) && config.buildInfo.env === 'development' && (
            <LinkButton href="admin/users/create" variant="primary">
              <Trans i18nKey="admin.users-list.create-button">New user</Trans>
            </LinkButton>
          )}
        </div>
      </div>
      <div className="sr-only" ref={statusRef} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
        {' '}
        {statusMessage}
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
    // BMC Code : Accessibility Change starts here.
    hiddenLabel: css({
      border: '0',
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: '0',
      position: 'absolute',
      width: '1px',
    }),
    // BMC Code : Accessibility Change ends here.
  };
};

export default UserListAdminPage;
