import { useMemo } from 'react';

import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { useGetOnCallIntegrationsQuery } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { createBridgeURL } from '../../PluginBridge';

import { isOnCallReceiver, ReceiverTypes } from './onCall/onCall';
import { AmRouteReceiver, GRAFANA_APP_RECEIVERS_SOURCE_IMAGE, ReceiverWithTypes } from './types';

export const useGetGrafanaReceiverTypeChecker = () => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data } = useGetOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });
  const getGrafanaReceiverType = (receiver: Receiver): SupportedPlugin | undefined => {
    //CHECK FOR ONCALL PLUGIN
    const onCallIntegrations = data ?? [];
    if (
      isOnCallEnabled &&
      isOnCallReceiver(
        receiver,
        onCallIntegrations.map((i) => i.integration_url)
      )
    ) {
      return SupportedPlugin.OnCall;
    }
    //WE WILL ADD IN HERE IF THERE ARE MORE TYPES TO CHECK
    return undefined;
  };

  return getGrafanaReceiverType;
};

export interface ReceiverMetadata {
  icon: string;
  title: string;
  externalUrl?: string;
  warning?: string;
}

export const useReceiversMetadata = (receivers: Receiver[]): Map<Receiver, ReceiverMetadata> => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data: onCallIntegrations = [] } = useGetOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  return useMemo(() => {
    if (!isOnCallEnabled) {
      return new Map<Receiver, ReceiverMetadata>();
    }

    const result = new Map<Receiver, ReceiverMetadata>();

    receivers.forEach((receiver) => {
      const onCallReceiver = receiver.grafana_managed_receiver_configs?.find((c) => c.type === ReceiverTypes.OnCall);

      if (onCallReceiver) {
        const matchingOnCallIntegration = onCallIntegrations.find(
          (i) => i.integration_url === onCallReceiver.settings.url
        );

        result.set(receiver, {
          icon: GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall],
          title: 'Grafana OnCall',
          externalUrl: matchingOnCallIntegration
            ? createBridgeURL(SupportedPlugin.OnCall, `/integrations/${matchingOnCallIntegration.id}`)
            : undefined,
          warning: matchingOnCallIntegration ? undefined : 'OnCall Integration no longer exists',
        });
      }
    });

    return result;
  }, [isOnCallEnabled, receivers, onCallIntegrations]);
};

export const useGetAmRouteReceiverWithGrafanaAppTypes = (receivers: Receiver[]) => {
  const getGrafanaReceiverType = useGetGrafanaReceiverTypeChecker();
  const receiverToSelectableContactPointValue = (receiver: Receiver): AmRouteReceiver => {
    const amRouteReceiverValue: AmRouteReceiver = {
      label: receiver.name,
      value: receiver.name,
      grafanaAppReceiverType: getGrafanaReceiverType(receiver),
    };
    return amRouteReceiverValue;
  };

  return receivers.map(receiverToSelectableContactPointValue);
};

export const useGetReceiversWithGrafanaAppTypes = (receivers: Receiver[]): ReceiverWithTypes[] => {
  const getGrafanaReceiverType = useGetGrafanaReceiverTypeChecker();
  return receivers.map((receiver: Receiver) => {
    return {
      ...receiver,
      grafanaAppReceiverType: getGrafanaReceiverType(receiver),
    };
  });
};
