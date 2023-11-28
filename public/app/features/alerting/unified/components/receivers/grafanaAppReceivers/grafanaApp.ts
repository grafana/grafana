import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { onCallApi } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';

import { isOnCallReceiver } from './onCall/onCall';
import { AmRouteReceiver } from './types';

export const useGetGrafanaReceiverTypeChecker = () => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });
  const getGrafanaReceiverType = (receiver: Receiver): SupportedPlugin | undefined => {
    //CHECK FOR ONCALL PLUGIN
    const onCallIntegrations = data ?? [];
    if (isOnCallEnabled && isOnCallReceiver(receiver, onCallIntegrations)) {
      return SupportedPlugin.OnCall;
    }
    //WE WILL ADD IN HERE IF THERE ARE MORE TYPES TO CHECK
    return undefined;
  };

  return getGrafanaReceiverType;
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
