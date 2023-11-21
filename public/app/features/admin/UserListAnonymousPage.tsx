import { css } from '@emotion/css';
import React, { ComponentType, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { StoreState, UserFilter } from '../../types';

import { AnonUsersTable } from './Users/AnonUsersTable';
import { fetchUsersAnonymous } from './state/actions';

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
  fetchUsersAnonymous,
};

const mapStateToProps = (state: StoreState) => ({
  devices: state.userListAnonymous.devices,
  showPaging: state.userListAnonymous.showPaging,
  totalPages: state.userListAnonymous.totalPages,
  page: state.userListAnonymous.page,
  filters: state.userListAnonymous.filters,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAnonymousPageUnConnected = ({
  devices,
  showPaging,
  totalPages,
  page,
  fetchUsersAnonymous,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // TODO: fetch devices here instead
    fetchUsersAnonymous();
  }, [fetchUsersAnonymous]);

  return (
    <Page.Contents>
      <div className={styles.actionBar} data-testid={selectors.container}>
        {/* <div className={styles.row}>
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
        </div> */}
      </div>
      <AnonUsersTable
        users={devices}
        showPaging={showPaging}
        totalPages={totalPages}
        currentPage={page}
      />
    </Page.Contents>
  );
};

export const UserListAnonymousPageContent = connector(UserListAnonymousPageUnConnected);

export function UserListAnonymousPage() {
  return (
    <Page navId="anonymous-users">
      <UserListAnonymousPageContent />
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

export default UserListAnonymousPage;
