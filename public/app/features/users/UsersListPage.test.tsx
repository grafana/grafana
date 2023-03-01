import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { configureStore } from 'app/store/configureStore';
import { Invitee, OrgUser } from 'app/types';

import { Props, UsersListPageUnconnected } from './UsersListPage';
import { pageChanged } from './state/reducers';

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
    page: 1,
    totalPages: 1,
    perPage: 30,
    externalUserMngInfo: '',
    fetchInvitees: jest.fn(),
    loadUsers: jest.fn(),
    updateUser: jest.fn(),
    removeUser: jest.fn(),
    changePage: mockToolkitActionCreator(pageChanged),
    isLoading: false,
  };

  Object.assign(props, propOverrides);

  render(
    <Provider store={store}>
      <UsersListPageUnconnected {...props} />
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
