import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { StorageLocations } from './StorageLocations';
import { StorageLocationsService } from './StorageLocations.service';
import { stubLocations } from './__mocks__/StorageLocations.service';

jest.mock('./StorageLocations.service');
jest.mock('app/core/app_events');

describe('StorageLocations', () => {
  it('should show delete modal when icon is clicked', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <MemoryRouter>{wrapWithGrafanaContextMock(<StorageLocations />)}</MemoryRouter>
      </Provider>
    );

    await screen.findByText('first location');
    const btn = screen.getAllByTestId('dropdown-menu-toggle')[0];
    await waitFor(() => fireEvent.click(btn));
    const deleteBtn = screen.getAllByTestId('dropdown-button')[1];
    await waitFor(() => fireEvent.click(deleteBtn));

    expect(screen.getByText(/Are you sure you want to delete the Storage Location/i)).toBeTruthy();
  });

  it('should close delete modal after deletion confirmation', async () => {
    const spy = jest.spyOn(StorageLocationsService, 'delete');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <MemoryRouter>{wrapWithGrafanaContextMock(<StorageLocations />)}</MemoryRouter>
      </Provider>
    );

    await screen.findByText('first location');

    const btn = screen.getAllByTestId('dropdown-menu-toggle')[0];
    await waitFor(() => fireEvent.click(btn));
    const deleteBtn = screen.getAllByTestId('dropdown-button')[1];
    await waitFor(() => fireEvent.click(deleteBtn));

    expect(screen.getByText('Delete Storage Location')).toBeTruthy();
    fireEvent.submit(screen.getByTestId('confirm-delete-modal-button'));

    await screen.findByText('first location');

    expect(screen.queryByText('Delete Storage Location')).toBeFalsy();
    expect(spy).toHaveBeenCalledWith(stubLocations.locations[0].location_id, false);
  });

  it('should open the modal by clicking the "Add" button', async () => {
    await waitFor(() =>
      render(
        <Provider
          store={configureStore({
            percona: {
              user: { isAuthorized: true },
              settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
            },
          } as StoreState)}
        >
          <MemoryRouter>{wrapWithGrafanaContextMock(<StorageLocations />)}</MemoryRouter>
        </Provider>
      )
    );

    await screen.findByText('first location');

    expect(screen.queryByText('Add Storage Location')).toBeFalsy();

    await waitFor(() => fireEvent.click(screen.getAllByTestId('storage-location-add-modal-button')[0]));

    expect(screen.getByText('Add Storage Location')).toBeTruthy();
  });
});
