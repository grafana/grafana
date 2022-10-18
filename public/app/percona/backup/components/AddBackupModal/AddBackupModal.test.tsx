import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { LocationType } from '../StorageLocations/StorageLocations.types';

import { AddBackupModal } from './AddBackupModal';

jest.mock('./AddBackupModal.service');

describe('AddBackupModal', () => {
  it('should render fields', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
            backupLocations: {
              result: [
                {
                  locationID: 'location_1',
                  name: 'Location 1',
                  type: LocationType.S3,
                },
                {
                  locationID: 'location_2',
                  name: 'Location 2',
                  type: LocationType.CLIENT,
                },
              ],
              loading: false,
            },
          },
        } as unknown as StoreState)}
      >
        <AddBackupModal isVisible backup={null} onClose={jest.fn()} onBackup={jest.fn()} />
      </Provider>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));

    expect(screen.getAllByTestId('service-select-label')).toHaveLength(1);
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.filter((textbox) => textbox.tagName === 'INPUT')).toHaveLength(2);
    expect(textboxes.filter((textbox) => textbox.tagName === 'TEXTAREA')).toHaveLength(1);
    expect(screen.queryByTestId('advanced-backup-fields')).not.toBeInTheDocument();
    expect(screen.queryByTestId('retry-mode-selector')).toBeInTheDocument();
    expect(screen.queryAllByText('Incremental')).toHaveLength(0);
    expect(screen.queryAllByText('Full')).toHaveLength(0);
  });

  it('should render advanced fields when in schedule mode', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
            backupLocations: {
              result: [
                {
                  locationID: 'location_1',
                  name: 'Location 1',
                  type: LocationType.S3,
                },
                {
                  locationID: 'location_2',
                  name: 'Location 2',
                  type: LocationType.CLIENT,
                },
              ],
              loading: false,
            },
          },
        } as unknown as StoreState)}
      >
        <AddBackupModal isVisible scheduleMode backup={null} onClose={jest.fn()} onBackup={jest.fn()} />
      </Provider>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.getByTestId('advanced-backup-fields')).toBeInTheDocument();
    expect(screen.getByTestId('multi-select-field-div-wrapper').children).not.toHaveLength(0);
    expect(screen.queryByTestId('retry-mode-selector')).toBeInTheDocument();
  });

  it('should render backup mode selector when in schedule mode', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
            backupLocations: {
              result: [
                {
                  locationID: 'location_1',
                  name: 'Location 1',
                  type: LocationType.S3,
                },
                {
                  locationID: 'location_2',
                  name: 'Location 2',
                  type: LocationType.CLIENT,
                },
              ],
              loading: false,
            },
          },
        } as unknown as StoreState)}
      >
        <AddBackupModal isVisible scheduleMode backup={null} onClose={jest.fn()} onBackup={jest.fn()} />
      </Provider>
    );
    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.queryByText('Incremental')).toBeInTheDocument();
    expect(screen.queryByText('Full')).toBeInTheDocument();
  });
});
