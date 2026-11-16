import { useEffect } from 'react';
import { connect, type ConnectedProps } from 'react-redux';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, useStyles2, FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { type StoreState } from 'app/types/store';

import { AnonUsersDevicesTable } from './Users/AnonUsersTable';
import { getToolbarStyles } from './Users/getToolbarStyles';
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
  const styles = useStyles2(getToolbarStyles);

  useEffect(() => {
    fetchUsersAnonymousDevices();
  }, [fetchUsersAnonymousDevices]);

  return (
    <Page.Contents>
      <div className={styles.toolbar} data-testid={selectors.container}>
        <FilterInput
          className={styles.search}
          placeholder={t(
            'admin.user-list-anonymous-devices-page-un-connected.placeholder-search-devices-by-ip-address',
            'Search devices by IP address.'
          )}
          autoFocus={true}
          value={query}
          onChange={changeAnonQuery}
        />
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
          value={filters.find((f) => f.name === 'activeLast30Days')?.value}
          className={styles.filter}
        />
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
