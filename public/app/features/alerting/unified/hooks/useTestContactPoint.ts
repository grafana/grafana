import { useCallback, useMemo } from 'react';

import {
  type GrafanaManagedContactPoint,
  type GrafanaManagedReceiverConfig,
} from 'app/plugins/datasource/alertmanager/types';

import { type CreateReceiverTestOverrideArg, useCreateReceiverTestMutation } from '../api/testReceiversApi';
import { type GrafanaChannelValues } from '../types/receiver-form';
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
  const [createTestReceiver, apiState] = useCreateReceiverTestMutation();

  const canTest = useMemo(() => {
    if (!contactPoint) {
      // For new receivers, assume user can test if they can create
      return true;
    }
    return canTestEntity(contactPoint);
  }, [contactPoint]);

  const testChannel = useCallback(
    async ({ channelValues, existingIntegration, alert }: TestChannelParams) => {
      const defaultAlert = {
        labels: { alertname: 'TestAlert' },
        annotations: {},
      };
      const testAlert = alert || defaultAlert;
      const receiverUid = contactPoint?.id || '';

      const integrationConfig = formChannelValuesToGrafanaChannelConfig(
        channelValues,
        defaultChannelValues,
        'test',
        existingIntegration
      );

      const request: CreateReceiverTestOverrideArg = {
        name: receiverUid,
        body: {
          integration: {
            uid: existingIntegration?.uid,
            type: integrationConfig.type,
            version: integrationConfig.version,
            settings: integrationConfig.settings,
            secureFields: integrationConfig.secureFields,
            disableResolveMessage: integrationConfig.disableResolveMessage,
          },
          alert: testAlert,
        },
      };

      const result = await createTestReceiver(request).unwrap();

      if (result.status === 'failure') {
        throw new Error(result.error || 'Test notification failed');
      }

      return result;
    },
    [contactPoint, defaultChannelValues, createTestReceiver]
  );

  return {
    testChannel,
    canTest,
    isLoading: apiState.isLoading,
    error: apiState.error,
    isSuccess: apiState.isSuccess,
  };
}
