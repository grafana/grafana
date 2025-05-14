import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { Provider } from 'react-redux';

import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { stubRoles, stubUsers, stubUsersMap } from '../__mocks__/stubs';

import AccessRolesPage from './AccessRoles';

jest.mock('app/features/users/state/actions', () => ({
  loadUsers: () => () => ({}),
}));

const wrapWithProvider = (children: ReactElement) => (
  <Provider
    store={configureStore({
      users: {
        users: [
          {
            userId: 1,
          },
        ],
      },
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
    {wrapWithGrafanaContextMock(children)}
  </Provider>
);

describe('AccessRolesPage', () => {
  it('fetches roles  on render', () => {
    const fetchRolesActionSpy = jest.spyOn(RolesReducer, 'fetchRolesAction');

    render(wrapWithProvider(<AccessRolesPage />));

    expect(fetchRolesActionSpy).toHaveBeenCalled();
  });
});
