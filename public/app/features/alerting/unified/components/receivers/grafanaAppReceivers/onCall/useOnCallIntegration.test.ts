import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { mockApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { onCallPluginMetaMock } from 'app/features/alerting/unified/mocks';
import { option } from 'app/features/alerting/unified/utils/notifier-types';
import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { ONCALL_INTEGRATION_V2_FEATURE } from '../../../../api/onCallApi';

import { ReceiverTypes } from './onCall';
import { OnCallIntegrationSetting, OnCallIntegrationType, useOnCallIntegration } from './useOnCallIntegration';

const server = setupMswServer();

describe('useOnCallIntegration', () => {
  afterEach(() => {
    server.resetHandlers();
    clearPluginSettingsCache();
  });

  describe('When OnCall Alerting V2 integration enabled', () => {
    it('extendOnCalReceivers should add new settings to the oncall receiver', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.features([ONCALL_INTEGRATION_V2_FEATURE]);
      mockApi(server).oncall.getOnCallIntegrations([]);

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallReceivers } = result.current;

      const receiver = extendOnCallReceivers({
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

    it('createOnCallIntegrations should provide integration name and url validators', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.features([ONCALL_INTEGRATION_V2_FEATURE]);
      mockApi(server).oncall.getOnCallIntegrations([
        {
          display_name: 'grafana-integration',
          value: 'ABC123',
          integration_url: 'https://oncall.com/grafana-integration',
        },
      ]);
      mockApi(server).oncall.validateIntegrationName(['grafana-integration', 'alertmanager-integration']);
      mockApi(server).oncall.createIntegraion();

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { onCallFormValidators } = result.current;

      const gfValidationResult = await waitFor(() => onCallFormValidators.integration_name('grafana-integration'));
      expect(gfValidationResult).toBe('Integration of this name already exists in OnCall');

      const amValidationResult = await waitFor(() => onCallFormValidators.integration_name('alertmanager-integration'));
      expect(amValidationResult).toBe('Integration of this name already exists in OnCall');

      // ULR validator should check if the provided URL already exists
      expect(onCallFormValidators.url('https://oncall.com/grafana-integration')).toBe(true);

      expect(onCallFormValidators.url('https://oncall.com/alertmanager-integration')).toBe(
        'Selection of existing OnCall integration is required'
      );
    });

    it('extendOnCallNotifierFeatures should add integration type and name options and swap url to a select option', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.features([ONCALL_INTEGRATION_V2_FEATURE]);
      mockApi(server).oncall.getOnCallIntegrations([
        {
          display_name: 'grafana-integration',
          value: 'ABC123',
          integration_url: 'https://oncall.com/grafana-integration',
        },
      ]);

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallNotifierFeatures } = result.current;

      const notifier = extendOnCallNotifierFeatures({
        name: 'Grafana OnCall',
        type: 'oncall',
        options: [option('url', 'Grafana OnCall', 'Grafana OnCall', { element: 'input' })],
        description: '',
        heading: '',
      });

      expect(notifier.options).toHaveLength(3);
      expect(notifier.options[0].propertyName).toBe(OnCallIntegrationSetting.IntegrationType);
      expect(notifier.options[1].propertyName).toBe(OnCallIntegrationSetting.IntegrationName);
      expect(notifier.options[2].propertyName).toBe('url');

      expect(notifier.options[0].element).toBe('radio');
      expect(notifier.options[2].element).toBe('select');

      expect(notifier.options[2].selectOptions).toHaveLength(1);
      expect(notifier.options[2].selectOptions![0]).toMatchObject({
        label: 'grafana-integration',
        value: 'https://oncall.com/grafana-integration',
      });
    });
  });

  describe('When OnCall Alerting V2 integration disabled', () => {
    it('extendOnCalReceivers should not add new settings to the oncall receiver', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.features([]);
      mockApi(server).oncall.getOnCallIntegrations([]);

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallReceivers } = result.current;

      const receiver = extendOnCallReceivers({
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

      expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationType]).toBeUndefined();
      expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationName]).toBeUndefined();
    });

    it('extendConCallNotifierFeatures should not extend notifier', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: true });
      mockApi(server).oncall.features([]);
      mockApi(server).oncall.getOnCallIntegrations([]);

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallNotifierFeatures } = result.current;

      const notifier = extendOnCallNotifierFeatures({
        name: 'Grafana OnCall',
        type: 'oncall',
        options: [option('url', 'Grafana OnCall', 'Grafana OnCall', { element: 'input' })],
        description: '',
        heading: '',
      });

      expect(notifier.options).toHaveLength(1);
      expect(notifier.options[0].propertyName).toBe('url');
    });
  });

  describe('When OnCall plugin disabled', () => {
    it('extendOnCalReceivers should not add new settings to the oncall receiver', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: false });

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallReceivers } = result.current;

      const receiver = extendOnCallReceivers({
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

      expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationType]).toBeUndefined();
      expect(receiverConfig.settings[OnCallIntegrationSetting.IntegrationName]).toBeUndefined();
    });

    it('extendConCallNotifierFeatures should not extend notifier', async () => {
      mockApi(server).plugins.getPluginSettings({ ...onCallPluginMetaMock, enabled: false });

      const { result } = renderHook(() => useOnCallIntegration(), { wrapper: TestProvider });

      await waitFor(() => expect(result.current.isLoadingOnCallIntegration).toBe(false));

      const { extendOnCallNotifierFeatures } = result.current;

      const notifier = extendOnCallNotifierFeatures({
        name: 'Grafana OnCall',
        type: 'oncall',
        options: [option('url', 'Grafana OnCall', 'Grafana OnCall', { element: 'input' })],
        description: '',
        heading: '',
      });

      expect(notifier.options).toHaveLength(1);
      expect(notifier.options[0].propertyName).toBe('url');
    });
  });
});
