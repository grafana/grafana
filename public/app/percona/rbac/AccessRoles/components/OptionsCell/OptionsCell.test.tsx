import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import * as Reducers from 'app/percona/shared/core/reducers';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { stubRoles, stubUsers, stubUsersMap } from '../../../__mocks__/stubs';

import OptionsCell from './OptionsCell';

jest.mock('app/percona/shared/services/roles/Roles.service');
jest.mock('app/percona/settings/Settings.service');

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

const renderDefault = (isDefault = false) =>
  render(wrapWithProvider(<OptionsCell role={{ ...stubRoles[0], isDefault }} />));

describe('OptionsCell', () => {
  beforeEach(() => {
    setLocationService(new HistoryWrapper());
  });

  it('shows all options when role is not default', async () => {
    renderDefault();

    const optionsButton = screen.getByLabelText('Open role options');
    fireEvent.click(optionsButton);

    await waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Set as default')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Delete')).toBeInTheDocument());
  });

  it('shows all options when role is default', async () => {
    renderDefault(true);

    const optionsButton = screen.getByLabelText('Open role options');
    fireEvent.click(optionsButton);

    await waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Set as default')).toBeNull());
    await waitFor(() => expect(screen.queryByText('Delete')).toBeNull());
  });

  it('navigates to edit page', async () => {
    renderDefault(true);

    const optionsButton = screen.getByLabelText('Open role options');
    fireEvent.click(optionsButton);

    await waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(locationService.getLocation().pathname).toBe('/roles/1/edit');
  });

  it('sets role as default', async () => {
    const setAsDefaultRoleActionSpy = jest.spyOn(RolesReducer, 'setAsDefaultRoleAction');
    const fetchSettingsActionSpy = jest.spyOn(Reducers, 'fetchSettingsAction');

    renderDefault();

    const optionsButton = screen.getByLabelText('Open role options');
    fireEvent.click(optionsButton);

    await waitFor(() => expect(screen.queryByText('Set as default')).toBeInTheDocument());

    const setDefaultButton = screen.getByText('Set as default');
    fireEvent.click(setDefaultButton);

    await waitFor(() => expect(setAsDefaultRoleActionSpy).toHaveBeenCalled());
    await waitFor(() => expect(fetchSettingsActionSpy).toHaveBeenCalled());
  });

  it('opens delete modal when trying to delete', async () => {
    renderDefault();

    const optionsButton = screen.getByLabelText('Open role options');
    fireEvent.click(optionsButton);

    await waitFor(() => expect(screen.queryByText('Delete')).toBeInTheDocument());

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    await waitFor(() => expect(screen.getByText('Delete "Role #1" role')).toBeInTheDocument());
  });
});
