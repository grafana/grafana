import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { mockApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { onCallPluginMetaMock } from 'app/features/alerting/unified/mocks';

import { ReceiverTypes } from './onCall';
import { OnCallIntegrationSetting, OnCallIntegrationType, useOnCallIntegration } from './useOnCallIntegration';

const server = setupMswServer();

beforeEach(() => {
  server.resetHandlers();
});

describe('useOnCallIntegration', () => {
  test('extendOnCalReceivers should add new settings to the oncall receiver', async () => {
    mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
    mockApi(server).oncall.getOnCallIntegrations([]);

    const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

    await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

    const { extendOnCalReceivers } = result.current;

    const receiver = extendOnCalReceivers({
      name: 'OnCall Conctact point',
      grafana_managed_receiver_configs: [
        {
          name: 'Oncall-integration',
          type: ReceiverTypes.OnCall,
          settings: {
            url: 'https://oncall-endpoint.example.com',
          },
          disableResolveMessage: false,
        },
      ],
    });

    const receiverConfig = receiver.grafana_managed_receiver_configs![0];

    expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationType]).toBe(
      OnCallIntegrationType.ExistingIntegration
    );
    expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationName]).toBeUndefined();
    expect(receiverConfig.settings['url']).toBe('https://oncall-endpoint.example.com');
  });

  test('createOnCallIntegrations should create a new oncall integration for each new contact point integration', async () => {
    mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
    mockApi(server).oncall.getOnCallIntegrations([]);
    mockApi(server).oncall.createIntegraion();

    const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

    await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

    const { createOnCallIntegrations } = result.current;

    const receiver = await createOnCallIntegrations({
      name: 'OnCall Conctact point',
      grafana_managed_receiver_configs: [
        {
          name: 'oncall-test-1',
          type: ReceiverTypes.OnCall,
          settings: {
            [OnCallIntegrationSetting.IntegrationType]: OnCallIntegrationType.NewIntegration,
            [OnCallIntegrationSetting.IntegrationName]: 'oncall-test-1',
          },
          disableResolveMessage: false,
        },
        {
          name: 'oncall-test-2',
          type: ReceiverTypes.OnCall,
          settings: {
            [OnCallIntegrationSetting.IntegrationType]: OnCallIntegrationType.NewIntegration,
            [OnCallIntegrationSetting.IntegrationName]: 'oncall-test-2',
          },
          disableResolveMessage: false,
        },
      ],
    });

    await waitFor(() => expect(result.current.onCallFormValidators.integration_name('oncall-test-1')).not.toBe(true));

    expect(receiver.grafana_managed_receiver_configs?.length).toBe(2);

    receiver.grafana_managed_receiver_configs?.forEach((config) => {
      expect(config.settings['url']).toMatch(/https:\/\/oncall-endpoint\.example\.com\/oncall-integration-\d+/);
      expect(config.settings[OnCallIntegrationSetting.IntegrationName]).toBeUndefined();
    });
  });
});
