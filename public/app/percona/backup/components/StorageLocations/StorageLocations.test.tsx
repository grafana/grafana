import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { StorageLocationsService } from './StorageLocations.service';
import { stubLocations } from './__mocks__/StorageLocations.service';
import { StorageLocations } from './StorageLocations';

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
        <StorageLocations />
      </Provider>
    );

    await screen.findByText('first location');
    expect(screen.queryByText('Delete Storage Location')).toBeFalsy();

    fireEvent.click(screen.getAllByTestId('delete-storage-location-button')[0]);

    expect(screen.getByText('Delete Storage Location')).toBeTruthy();
  });

  it('should close delete modal after deletion confirmation', async () => {
    const spy = spyOn(StorageLocationsService, 'delete').and.callThrough();
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <StorageLocations />
      </Provider>
    );

    await screen.findByText('first location');

    fireEvent.click(screen.getAllByTestId('delete-storage-location-button')[0]);

    expect(screen.getByText('Delete Storage Location')).toBeTruthy();
    fireEvent.submit(screen.getByTestId('confirm-delete-modal-button'));

    await screen.findByText('first location');

    expect(screen.queryByText('Delete Storage Location')).toBeFalsy();
    expect(spy).toHaveBeenCalledWith(stubLocations.locations[0].location_id, false);
  });

  it('should open the modal by clicking the "Add" button', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <StorageLocations />
      </Provider>
    );

    await screen.findByText('first location');

    expect(screen.queryByText('Add Storage Location')).toBeFalsy();

    fireEvent.click(screen.getAllByTestId('storage-location-add-modal-button')[0]);

    expect(screen.getByText('Add Storage Location')).toBeTruthy();
  });
});
