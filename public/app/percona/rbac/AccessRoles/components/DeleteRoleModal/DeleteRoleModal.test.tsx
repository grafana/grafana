import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { UserService } from 'app/percona/shared/services/user/__mocks__/User.service';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { stubRoles, stubUsers, stubUsersMap } from '../../../__mocks__/stubs';

import DeleteRoleModal from './DeleteRoleModal';

jest.mock('app/percona/shared/services/roles/Roles.service');
jest.mock('app/percona/shared/services/user/User.service', () => ({
  ...UserService,
  getUsersList: () =>
    Promise.resolve({
      users: [
        {
          role_ids: stubUsers[0].roleIds,
          user_id: stubUsers[0].userId,
        },
      ],
    }),
}));

const cancelFn = jest.fn();

const wrapWithProvider = (children: ReactElement) => (
  <Provider
    store={configureStore({
      users: {
        users: [
          {
            userId: stubUsers[0].userId,
          },
        ],
      },
      percona: {
        users: {
          isLoading: false,
          users: [stubUsers[0]],
          usersMap: stubUsersMap,
        },
        roles: {
          isLoading: false,
          roles: stubRoles,
        },
      },
    } as StoreState)}
  >
    {children}
  </Provider>
);

const renderDefault = (isOpen = true, role = stubRoles[0]) =>
  render(wrapWithProvider(<DeleteRoleModal role={role} isOpen={isOpen} onCancel={cancelFn} />));

describe('DeleteRoleModal', () => {
  beforeEach(() => {
    cancelFn.mockClear();
  });

  it("doesn't render when it's closed", () => {
    renderDefault(false);
    expect(screen.queryByText('Delete "Role #1" role')).toBeNull();
  });

  it("renders when it's open", () => {
    renderDefault();
    expect(screen.queryByText('Delete "Role #1" role')).not.toBeNull();
  });

  it('calls delete', async () => {
    const deleteRoleActionSpy = jest.spyOn(RolesReducer, 'deleteRoleAction');
    renderDefault(true, stubRoles[1]);

    await waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());

    const deleteButton = screen.getByText('Confirm and delete role');
    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteRoleActionSpy).toHaveBeenCalled());
  });

  it('shows role replacement selection when users are assigned', async () => {
    renderDefault(true, stubRoles[0]);

    await waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());

    await waitFor(() => expect(screen.queryByLabelText('Replacement role')).toBeInTheDocument());
  });

  it('doesnt show  role replacement selection when no users are assigned', async () => {
    renderDefault(true, stubRoles[1]);

    await waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());

    await waitFor(() => expect(screen.queryByLabelText('Replacement role')).toBeNull());
  });
});
