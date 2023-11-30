import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Page } from 'app/core/components/Page/Page';

import { StoreState } from '../../types';

import { AnonUsersDevicesTable } from './Users/AnonUsersTable';
import { fetchUsersAnonymousDevices } from './state/actions';

const mapDispatchToProps = {
  fetchUsersAnonymousDevices,
};

const mapStateToProps = (state: StoreState) => ({
  devices: state.userListAnonymousDevices.devices,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAnonymousDevicesPageUnConnected = ({ devices, fetchUsersAnonymousDevices }: Props) => {
  useEffect(() => {
    fetchUsersAnonymousDevices();
  }, [fetchUsersAnonymousDevices]);

  return (
    <Page.Contents>
      <AnonUsersDevicesTable devices={devices} />
    </Page.Contents>
  );
};

export const UserListAnonymousDevicesPageContent = connector(UserListAnonymousDevicesPageUnConnected);

export function UserListAnonymousDevicesPage() {
  return (
    <Page navId="anonymous-users">
      <UserListAnonymousDevicesPageContent />
    </Page>
  );
}

export default UserListAnonymousDevicesPage;
