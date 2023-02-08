import { fireEvent, render, screen } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { stubRoles, stubUsers, stubUsersMap } from '../../../__mocks__/stubs';

import DeleteRoleModal from './DeleteRoleModal';

const cancelFn = jest.fn();

const wrapWithProvider = (children: ReactElement) => (
  <Provider
    store={configureStore({
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

  it("doesn't show delete button if the role is assigned", () => {
    renderDefault();
    expect(screen.queryByText('Confirm and delete role')).toBeNull();
  });

  it('shows delete button if the role is not assigned', () => {
    renderDefault(true, stubRoles[1]);
    expect(screen.queryByText('Confirm and delete role')).not.toBeNull();
  });

  it('calls delete', () => {
    const deleteRoleActionSpy = jest.spyOn(RolesReducer, 'deleteRoleAction');
    renderDefault(true, stubRoles[1]);

    const deleteButton = screen.getByText('Confirm and delete role');
    fireEvent.click(deleteButton);

    expect(deleteRoleActionSpy).toHaveBeenCalled();
  });
});
