import { isEqual } from 'lodash';
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

/**
 * Determines if the form values have changed from the original integration.
 * If unchanged, we can use test-by-reference mode (more efficient).
 */
function hasIntegrationChanged(
  channelValues: GrafanaChannelValues,
  existingIntegration?: GrafanaManagedReceiverConfig
): boolean {
  if (!existingIntegration) {
    return true;
  }

  if (channelValues.type !== existingIntegration.type) {
    return true;
  }

  if (!isEqual(channelValues.settings, existingIntegration.settings)) {
    return true;
  }

  if (channelValues.disableResolveMessage !== existingIntegration.disableResolveMessage) {
    return true;
  }

  // Check if any secure fields were modified
  // A secure field is "modified" if it was previously stored (value = true)
  // but the form no longer has it marked as secure (value = false or missing)
  const existingSecureFields = existingIntegration.secureFields || {};
  const formSecureFields = channelValues.secureFields || {};

  for (const [key, wasSecure] of Object.entries(existingSecureFields)) {
    if (wasSecure === true && formSecureFields[key] !== true) {
      // User cleared or changed this secure field
      return true;
    }
  }

  return false;
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
      const integrationChanged = hasIntegrationChanged(channelValues, existingIntegration);
      const existingIntegrationUid = existingIntegration?.uid;
      const shouldTestWithConfig = integrationChanged || !existingIntegrationUid;

      let request: TestIntegrationRequest;

      if (shouldTestWithConfig) {
        const integrationConfig = formChannelValuesToGrafanaChannelConfig(
          channelValues,
          defaultChannelValues,
          'test',
          existingIntegration
        );

        request = {
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
      } else {
        request = {
          receiverUid,
          integrationRef: { uid: existingIntegrationUid },
          alert: testAlert,
        };
      }

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
