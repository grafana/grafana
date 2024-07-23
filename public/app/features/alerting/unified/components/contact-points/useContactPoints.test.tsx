import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import alertmanagerMock from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import { setOnCallIntegrations } from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { AccessControlAction } from 'app/types';

import { mockApi, setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { useContactPointsWithStatus } from './useContactPoints';

const server = setupMswServer();

describe('useContactPoints', () => {
  beforeAll(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  it('should return contact points with status', async () => {
    setOnCallIntegrations([
      {
        display_name: 'grafana-integration',
        value: 'ABC123',
        integration_url: 'https://oncall-endpoint.example.com',
      },
    ]);
    mockApi(server).getContactPointsList(receivers);

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
    });
    expect(result.current).toMatchSnapshot();
  });

  describe('when having oncall plugin installed and no alert manager config data', () => {
    it('should return contact points with oncall metadata', async () => {
      setOnCallIntegrations([
        {
          display_name: 'grafana-integration',
          value: 'ABC123',
          integration_url: 'https://oncall-endpoint.example.com',
        },
      ]);
      mockApi(server).getContactPointsList(receivers);

      const { result } = renderHook(
        () => useContactPointsWithStatus({ includePoliciesCount: false, receiverStatusPollingInterval: 0 }),
        {
          wrapper: ({ children }) => (
            <TestProvider>
              <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={'grafana'}>
                {children}
              </AlertmanagerProvider>
            </TestProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current).toMatchSnapshot();
    });
  });
});

const receivers = JSON.parse(JSON.stringify(alertmanagerMock)).alertmanager_config.receivers;
