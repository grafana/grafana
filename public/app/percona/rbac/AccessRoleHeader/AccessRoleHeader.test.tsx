import { render, screen } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import * as UsersReducer from 'app/percona/shared/core/reducers/users/users';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { stubRoles, stubUsers, stubUsersMap } from '../__mocks__/stubs';

import AccessRoleHeader from './AccessRoleHeader';

const wrapWithProvider = (children: ReactElement, enableAccessControl = true) => (
  <Provider
    store={configureStore({
      percona: {
        users: {
          isLoading: false,
          users: stubUsers,
          usersMap: stubUsersMap,
        },
        roles: {
          isLoading: false,
          roles: stubRoles,
        },
      },
    } as StoreState)}
  >
    <table>
      <thead>
        <tr>{children}</tr>
      </thead>
    </table>
  </Provider>
);

describe('AccessRoleHeader', () => {
  it('renders correctly', () => {
    render(wrapWithProvider(<AccessRoleHeader />));
    expect(screen.getByTestId('access-role-header')).toHaveTextContent('Access Role');
  });

  it('fetches roles and users on render', () => {
    const fetchRolesActionSpy = jest.spyOn(RolesReducer, 'fetchRolesAction');
    const fetchUsersListActionSpy = jest.spyOn(UsersReducer, 'fetchUsersListAction');

    render(wrapWithProvider(<AccessRoleHeader />));

    expect(fetchRolesActionSpy).toHaveBeenCalled();
    expect(fetchUsersListActionSpy).toHaveBeenCalled();
  });
});
