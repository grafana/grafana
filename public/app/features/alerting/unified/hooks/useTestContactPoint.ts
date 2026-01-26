import { useCallback, useMemo } from 'react';

import { config } from '@grafana/runtime';
import { GrafanaManagedContactPoint, GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';

import { useTestIntegrationMutation } from '../api/receiversApi';
import { TestIntegrationRequest, useTestIntegrationK8sMutation } from '../api/testIntegrationApi';
import { GrafanaChannelValues } from '../types/receiver-form';
import { canTestEntity } from '../utils/k8s/utils';
import { formChannelValuesToGrafanaChannelConfig } from '../utils/receiver-form';

interface UseTestContactPointOptions {
  contactPoint?: GrafanaManagedContactPoint;
  defaultChannelValues: GrafanaChannelValues;
}

interface TestChannelParams {
  channelValues: GrafanaChannelValues;
  existingIntegration?: GrafanaManagedReceiverConfig;
  alert?: {
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
}

export function useTestContactPoint({ contactPoint, defaultChannelValues }: UseTestContactPointOptions) {
  const [testOldApi, oldApiState] = useTestIntegrationMutation();
  const [testNewApi, newApiState] = useTestIntegrationK8sMutation();

  const useK8sApi = Boolean(config.featureToggles.alertingImportAlertmanagerUI);

  const canTest = useMemo(() => {
    if (!contactPoint) {
      // For new receivers, assume user can test if they can create
      return true;
    }
    return canTestEntity(contactPoint);
  }, [contactPoint]);

  const testWithK8sApi = useCallback(
    async ({
      channelValues,
      existingIntegration,
      testAlert,
    }: TestChannelParams & { testAlert: { labels: Record<string, string>; annotations: Record<string, string> } }) => {
      const receiverUid = contactPoint?.id || '';

      const integrationConfig = formChannelValuesToGrafanaChannelConfig(
        channelValues,
        defaultChannelValues,
        'test',
        existingIntegration
      );

      const request: TestIntegrationRequest = {
        receiverUid,
        integration: {
          uid: existingIntegration?.uid,
          type: integrationConfig.type,
          version: integrationConfig.version,
          settings: integrationConfig.settings,
          secureFields: integrationConfig.secureFields,
          disableResolveMessage: integrationConfig.disableResolveMessage,
        },
        alert: testAlert,
      };

      const result = await testNewApi(request).unwrap();

      if (result.status === 'failure') {
        throw new Error(result.error || 'Test notification failed');
      }

      return result;
    },
    [contactPoint, defaultChannelValues, testNewApi]
  );

  const testWithOldApi = useCallback(
    async ({ channelValues, existingIntegration, alert }: TestChannelParams) => {
      const chan = formChannelValuesToGrafanaChannelConfig(
        channelValues,
        defaultChannelValues,
        'test',
        existingIntegration
      );

      return testOldApi({
        alertManagerSourceName: 'grafana',
        receivers: [
          {
            name: contactPoint?.name ?? '',
            grafana_managed_receiver_configs: [chan],
          },
        ],
        alert: alert
          ? {
              annotations: alert.annotations,
              labels: alert.labels,
            }
          : undefined,
      }).unwrap();
    },
    [contactPoint, defaultChannelValues, testOldApi]
  );

  const testChannel = useCallback(
    async ({ channelValues, existingIntegration, alert }: TestChannelParams) => {
      const defaultAlert = {
        labels: { alertname: 'TestAlert' },
        annotations: {},
      };
      const testAlert = alert || defaultAlert;

      if (useK8sApi) {
        return testWithK8sApi({ channelValues, existingIntegration, testAlert });
      } else {
        return testWithOldApi({ channelValues, existingIntegration, alert });
      }
    },
    [useK8sApi, testWithK8sApi, testWithOldApi]
  );

  return {
    testChannel,
    canTest,
    isLoading: useK8sApi ? newApiState.isLoading : oldApiState.isLoading,
    error: useK8sApi ? newApiState.error : oldApiState.error,
    isSuccess: useK8sApi ? newApiState.isSuccess : oldApiState.isSuccess,
  };
}
