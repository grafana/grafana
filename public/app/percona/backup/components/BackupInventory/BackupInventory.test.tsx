import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { BackupInventory } from './BackupInventory';

jest.mock('./BackupInventory.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
jest.mock('app/percona/shared/core/hooks/recurringCall.hook');

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
        <MemoryRouter>{wrapWithGrafanaContextMock(<BackupInventory />)}</MemoryRouter>
      </Provider>
    );

    await screen.findByText('Backup 1');
    expect(screen.getByText('Location 1 (S3)')).toBeTruthy();
    expect(screen.getByText('Service 1')).toBeTruthy();
    expect(screen.getByText('Location 2 (Local Client)')).toBeTruthy();
    expect(screen.getByText('Service 2')).toBeTruthy();
  });
});
