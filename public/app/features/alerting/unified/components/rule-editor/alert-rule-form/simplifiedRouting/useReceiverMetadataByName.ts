import { useMemo } from 'react';

import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ReceiverTypes } from '../../../receivers/grafanaAppReceivers/onCall/onCall';
import { ReceiverPluginMetadata, getOnCallMetadata } from '../../../receivers/grafanaAppReceivers/useReceiversMetadata';

export const useReceiversMetadataMapByName = (receivers: Receiver[]): Map<string, ReceiverPluginMetadata> => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data: onCallIntegrations = [] } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  return useMemo(() => {
    const result = new Map<string, ReceiverPluginMetadata>();

    receivers.forEach((receiver) => {
      const onCallReceiver = receiver.grafana_managed_receiver_configs?.find((c) => c.type === ReceiverTypes.OnCall);

      if (onCallReceiver) {
        if (!isOnCallEnabled) {
          result.set(receiver.name, getOnCallMetadata(null, onCallReceiver));
          return;
        }

        result.set(receiver.name, getOnCallMetadata(onCallIntegrations, onCallReceiver));
      }
    });

    return result;
  }, [receivers, isOnCallEnabled, onCallIntegrations]);
};
