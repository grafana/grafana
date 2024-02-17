import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import { useContactPointsWithStatus } from './useContactPoints';

const server = setupMswServer();

describe('useContactPoints', () => {
  beforeEach(() => {
    setupGrafanaManagedServer(server);
  });

  beforeAll(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  it('should return contact points with status', async () => {
    const { result } = renderHook(() => useContactPointsWithStatus(), {
      wrapper: ({ children }) => (
        <TestProvider>
          <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={'grafana'}>
            {children}
          </AlertmanagerProvider>
        </TestProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});
