import { useMemo } from 'react';

import { GrafanaManagedReceiverConfig, Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { onCallApi, OnCallIntegrationDTO } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { createBridgeURL } from '../../PluginBridge';

import { ReceiverTypes } from './onCall/onCall';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';

export interface ReceiverPluginMetadata {
  icon: string;
  title: string;
  description?: string;
  externalUrl?: string;
  warning?: string;
}

const onCallReceiverICon = GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall];
const onCallReceiverTitle = 'Grafana OnCall';

const onCallReceiverMeta: ReceiverPluginMetadata = {
  title: onCallReceiverTitle,
  icon: onCallReceiverICon,
};

export const useReceiversMetadata = (receivers: Receiver[]): Map<Receiver, ReceiverPluginMetadata> => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data: onCallIntegrations = [] } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  return useMemo(() => {
    const result = new Map<Receiver, ReceiverPluginMetadata>();

    receivers.forEach((receiver) => {
      const onCallReceiver = receiver.grafana_managed_receiver_configs?.find((c) => c.type === ReceiverTypes.OnCall);

      if (onCallReceiver) {
        if (!isOnCallEnabled) {
          result.set(receiver, getOnCallMetadata(null, onCallReceiver));
          return;
        }

        result.set(receiver, getOnCallMetadata(onCallIntegrations, onCallReceiver));
      }
    });

    return result;
  }, [receivers, isOnCallEnabled, onCallIntegrations]);
};

export function getOnCallMetadata(
  onCallIntegrations: OnCallIntegrationDTO[] | undefined | null,
  receiver: GrafanaManagedReceiverConfig
): ReceiverPluginMetadata {
  // oncall status is still loading
  if (onCallIntegrations === undefined) {
    return onCallReceiverMeta;
  }

  // indication that onCall is not enabled
  if (onCallIntegrations == null) {
    return {
      ...onCallReceiverMeta,
      warning: 'Grafana OnCall is not installed or is disabled',
    };
  }

  const matchingOnCallIntegration = onCallIntegrations.find(
    (integration) => integration.integration_url === receiver.settings.url
  );

  return {
    ...onCallReceiverMeta,
    description: matchingOnCallIntegration?.display_name,
    externalUrl: matchingOnCallIntegration
      ? createBridgeURL(SupportedPlugin.OnCall, `/integrations/${matchingOnCallIntegration.value}`)
      : undefined,
    warning: matchingOnCallIntegration ? undefined : 'OnCall Integration no longer exists',
  };
}
