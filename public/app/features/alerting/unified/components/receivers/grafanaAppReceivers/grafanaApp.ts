import { useAsync } from 'react-use';

import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { useGetOnCallIntegrationsQuery } from '../../../api/onCallApi';

import { isOnCallReceiver } from './onCall/onCall';
import { AmRouteReceiver, GrafanaAppReceiverEnum, GRAFANA_APP_PLUGIN_IDS, ReceiverWithTypes } from './types';

export const useGetAppIsInstalledAndEnabled = (grafanaAppType: GrafanaAppReceiverEnum) => {
  const {
    loading,
    error,
    value: plugin,
  } = useAsync(() => getPluginSettings(GRAFANA_APP_PLUGIN_IDS[grafanaAppType], { showErrorAlert: false }));
  const installed = plugin && !error && !loading;
  return installed;
};

export const useGetGrafanaReceiverTypeChecker = () => {
  const isOnCallEnabled = useGetAppIsInstalledAndEnabled(GrafanaAppReceiverEnum.GRAFANA_ONCALL);
  const { data } = useGetOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  const getGrafanaReceiverType = (receiver: Receiver): GrafanaAppReceiverEnum | undefined => {
    //CHECK FOR ONCALL PLUGIN
    const onCallIntegrations = data ?? [];
    if (isOnCallEnabled && isOnCallReceiver(receiver, onCallIntegrations)) {
      return GrafanaAppReceiverEnum.GRAFANA_ONCALL;
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

export const useGetReceiversWithGrafanaAppTypes = (receivers: Receiver[]): ReceiverWithTypes[] => {
  const getGrafanaReceiverType = useGetGrafanaReceiverTypeChecker();
  return receivers.map((receiver: Receiver) => {
    return {
      ...receiver,
      grafanaAppReceiverType: getGrafanaReceiverType(receiver),
    };
  });
};
