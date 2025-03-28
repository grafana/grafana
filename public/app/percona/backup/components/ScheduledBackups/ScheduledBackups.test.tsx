import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { ScheduledBackups } from './ScheduledBackups';

jest.mock('./ScheduledBackups.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    pathname: '/',
  }),
}));

describe('ScheduledBackups', () => {
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
        <MemoryRouter>{wrapWithGrafanaContextMock(<ScheduledBackups />)}</MemoryRouter>
      </Provider>
    );
    await screen.findByText('Backup 1');
  });
});
