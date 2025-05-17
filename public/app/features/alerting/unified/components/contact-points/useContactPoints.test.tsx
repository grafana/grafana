import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { disablePlugin } from 'app/features/alerting/unified/mocks/server/configure';
import { setOnCallIntegrations } from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import { useContactPointsWithStatus } from './useContactPoints';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

setupMswServer();

const getHookResponse = async () => {
  const { result } = renderHook(
    () =>
      useContactPointsWithStatus({
        alertmanager: GRAFANA_RULES_SOURCE_NAME,
        fetchPolicies: true,
        fetchStatuses: true,
      }),
    {
      wrapper,
    }
  );

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  // Only return some properties, as we don't want to compare all
  // RTK query properties in snapshots/comparison between k8s and non-k8s implementations
  // (would include properties like requestId, fulfilled, etc.)
  const { contactPoints, error, isLoading } = result.current;

  return { contactPoints, error, isLoading };
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
    const snapshot = await getHookResponse();
    expect(snapshot).toMatchSnapshot();
  });

  describe('when having oncall plugin installed and no alert manager config data', () => {
    it('should return contact points with oncall metadata', async () => {
      const snapshot = await getHookResponse();
      expect(snapshot).toMatchSnapshot();
    });
  });
});
