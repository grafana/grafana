import { css } from '@emotion/css';
import { useEffect } from 'react';
import { connect, type ConnectedProps } from 'react-redux';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, useStyles2, FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { type StoreState } from 'app/types/store';

import { AnonUsersDevicesTable } from './Users/AnonUsersTable';
import { fetchUsersAnonymousDevices, changeAnonUserSort, changeAnonPage, changeAnonQuery } from './state/actions';

const mapDispatchToProps = {
  fetchUsersAnonymousDevices,
  changeAnonUserSort,
  changeAnonPage,
  changeAnonQuery,
};

const mapStateToProps = (state: StoreState) => ({
  devices: state.userListAnonymousDevices.devices,
  query: state.userListAnonymousDevices.query,
  showPaging: state.userListAnonymousDevices.showPaging,
  totalPages: state.userListAnonymousDevices.totalPages,
  page: state.userListAnonymousDevices.page,
  filters: state.userListAnonymousDevices.filters,
});

const selectors = e2eSelectors.pages.UserListPage.UserListAdminPage;

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAnonymousDevicesPageUnConnected = ({
  devices,
  fetchUsersAnonymousDevices,
  query,
  changeAnonQuery,
  filters,
  showPaging,
  totalPages,
  page,
  changeAnonPage,
  changeAnonUserSort,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchUsersAnonymousDevices();
  }, [fetchUsersAnonymousDevices]);

  return (
    <Page.Contents>
      <div className={styles.actionBar} data-testid={selectors.container}>
        <div className={styles.row}>
          <div className={styles.search}>
            <FilterInput
              placeholder={t(
                'admin.user-list-anonymous-devices-page-un-connected.placeholder-search-devices-by-ip-address',
                'Search devices by IP address.'
              )}
              autoFocus={true}
              value={query}
              onChange={changeAnonQuery}
            />
          </div>
          <div className={styles.filter}>
            <RadioButtonGroup
              options={[
                {
                  label: t(
                    'admin.user-list-anonymous-devices-page-un-connected.label.active-last-days',
                    'Active last 30 days'
                  ),
                  value: true,
                },
              ]}
              // onChange={(value) => changeFilter({ name: 'activeLast30Days', value })}
              value={filters.find((f) => f.name === 'activeLast30Days')?.value}
            />
          </div>
        </div>
      </div>
      <AnonUsersDevicesTable
        devices={devices}
        showPaging={showPaging}
        totalPages={totalPages}
        onChangePage={changeAnonPage}
        currentPage={page}
        fetchData={changeAnonUserSort}
      />
    </Page.Contents>
  );
};

export const UserListAnonymousDevicesPageContent = connector(UserListAnonymousDevicesPageUnConnected);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    search: css({
      flex: '1 1 240px',
      minWidth: theme.spacing(20),
    }),
    filter: css({
      flex: '0 0 auto',
      minWidth: 'max-content',
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
      alignItems: 'center',
      textAlign: 'left',
      marginBottom: theme.spacing(0.5),
      flexGrow: 1,
      minWidth: 0,
      width: '100%',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
    }),
  };
};
