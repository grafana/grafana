import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { disablePlugin } from 'app/features/alerting/unified/mocks/server/configure';
import { setOnCallIntegrations } from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { useContactPointsWithStatus } from './useContactPoints';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return (
    <ProviderWrapper>
      <AlertmanagerProvider accessType="notification" alertmanagerSourceName="grafana">
        {children}
      </AlertmanagerProvider>
    </ProviderWrapper>
  );
};

setupMswServer();

const getHookResponse = async (featureToggleEnabled: boolean) => {
  config.featureToggles.alertingApiServer = featureToggleEnabled;
  const { result } = renderHook(() => useContactPointsWithStatus(), {
    wrapper,
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  return result.current;
};

describe('useContactPoints', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
    setOnCallIntegrations([
      {
        display_name: 'grafana-integration',
        value: 'ABC123',
        integration_url: 'https://oncall-endpoint.example.com',
      },
    ]);
  });

  it('should return contact points with status', async () => {
    disablePlugin(SupportedPlugin.OnCall);
    const snapshot = await getHookResponse(false);
    expect(snapshot).toMatchSnapshot();
  });

  it('returns matching responses with and without alertingApiServer', async () => {
    const snapshotAmConfig = await getHookResponse(false);
    const snapshotAlertingApiServer = await getHookResponse(true);
    expect(snapshotAmConfig).toEqual(snapshotAlertingApiServer);
  });

  describe('when having oncall plugin installed and no alert manager config data', () => {
    it('should return contact points with oncall metadata', async () => {
      const snapshot = await getHookResponse(false);
      expect(snapshot).toMatchSnapshot();
    });
  });
});
