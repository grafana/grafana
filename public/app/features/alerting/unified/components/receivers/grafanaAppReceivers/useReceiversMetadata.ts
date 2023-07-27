import { useMemo } from 'react';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { onCallApi } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { createBridgeURL } from '../../PluginBridge';

import { ReceiverTypes } from './onCall/onCall';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';

export interface ReceiverMetadata {
  icon: string;
  title: string;
  externalUrl?: string;
  warning?: string;
}

const onCallReceiverICon = GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall];
const onCallReceiverTitle = 'Grafana OnCall';

const onCallReceiverMeta: ReceiverMetadata = {
  title: onCallReceiverTitle,
  icon: onCallReceiverICon,
};

export const useReceiversMetadata = (receivers: Receiver[]): Map<Receiver, ReceiverMetadata> => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data: onCallIntegrations = [] } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  return useMemo(() => {
    const result = new Map<Receiver, ReceiverMetadata>();

    receivers.forEach((receiver) => {
      const onCallReceiver = receiver.grafana_managed_receiver_configs?.find((c) => c.type === ReceiverTypes.OnCall);

      if (onCallReceiver) {
        if (!isOnCallEnabled) {
          result.set(receiver, {
            ...onCallReceiverMeta,
            warning: 'Grafana OnCall is not enabled',
          });
          return;
        }

        const matchingOnCallIntegration = onCallIntegrations.find(
          (i) => i.integration_url === onCallReceiver.settings.url
        );

        result.set(receiver, {
          ...onCallReceiverMeta,
          externalUrl: matchingOnCallIntegration
            ? createBridgeURL(SupportedPlugin.OnCall, `/integrations/${matchingOnCallIntegration.value}`)
            : undefined,
          warning: matchingOnCallIntegration ? undefined : 'OnCall Integration no longer exists',
        });
      }
    });

    return result;
  }, [isOnCallEnabled, receivers, onCallIntegrations]);
};
