import { useGetSingleLocalWithoutDetails } from 'app/features/plugins/admin/state/hooks';
import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { useGetOnCallIntegrationsQuery } from '../../../api/onCallApi';

import { isOnCallReceiver } from './onCall/onCall';
import { AmRouteReceiver, GrafanaAppReceiverEnum, GRAFANA_APP_PLUGIN_IDS, ReceiverWithTypes } from './types';

export const useGetAppIsInstalledAndEnabled = (grafanaAppType: GrafanaAppReceiverEnum) => {
  // fetches the plugin settings for this Grafana instance
  const plugin: CatalogPlugin | undefined = useGetSingleLocalWithoutDetails(GRAFANA_APP_PLUGIN_IDS[grafanaAppType]);
  return plugin?.isInstalled && !plugin?.isDisabled && plugin?.type === 'app';
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
    return;
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
