import { Receiver } from '../../../../../../../plugins/datasource/alertmanager/types';

export const isInOnCallIntegrations = (url: string, integrationsUrls: string[]) => {
  return integrationsUrls.findIndex((integrationUrl) => integrationUrl === url) !== -1;
};

export const isOnCallReceiver = (receiver: Receiver, integrationsUrls: string[]) => {
  if (!receiver.grafana_managed_receiver_configs) {
    return false;
  }
  const onlyOneIntegration = receiver.grafana_managed_receiver_configs.length === 1;
  const isOncall = isInOnCallIntegrations(
    receiver.grafana_managed_receiver_configs[0]?.settings?.url ?? '',
    integrationsUrls
  );
  return onlyOneIntegration && isOncall;
};
