import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { BackupInventory } from './BackupInventory';

jest.mock('./BackupInventory.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
jest.mock('../../hooks/recurringCall.hook');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    pathname: '/',
  }),
}));

describe('BackupInventory', () => {
  it('should send correct data to Table', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <BackupInventory />
      </Provider>
    );

    await screen.findByText('Backup 1');
    expect(screen.getByText('Location 1 (S3)')).toBeTruthy();
    expect(screen.getByText('Service 1')).toBeTruthy();
    expect(screen.getByText('Location 2 (Local Client)')).toBeTruthy();
    expect(screen.getByText('Service 2')).toBeTruthy();
  });
});
