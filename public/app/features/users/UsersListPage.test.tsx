import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { configureStore } from 'app/store/configureStore';
import { Invitee, OrgUser } from 'app/types';

import { Props, UsersListPage } from './UsersListPage';
import { setUsersSearchPage, setUsersSearchQuery } from './state/reducers';

jest.mock('../../core/app_events', () => ({
  emit: jest.fn(),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    user: { orgId: 1 },
    hasAccess: () => false,
    licensedAccessControlEnabled: () => false,
  },
}));

const setup = (propOverrides?: object) => {
  const store = configureStore();
  const props: Props = {
    users: [] as OrgUser[],
    invitees: [] as Invitee[],
    searchQuery: '',
    searchPage: 1,
    externalUserMngInfo: '',
    fetchInvitees: jest.fn(),
    loadUsers: jest.fn(),
    updateUser: jest.fn(),
    removeUser: jest.fn(),
    setUsersSearchQuery: mockToolkitActionCreator(setUsersSearchQuery),
    setUsersSearchPage: mockToolkitActionCreator(setUsersSearchPage),
    hasFetched: false,
  };

  Object.assign(props, propOverrides);

  render(
    <Provider store={store}>
      <UsersListPage {...props} />
    </Provider>
  );
};

describe('Render', () => {
  it('should render component', () => {
    expect(setup).not.toThrow();
  });

  it('should render List page', () => {
    expect(() =>
      setup({
        hasFetched: true,
      })
    ).not.toThrow();
  });
});
