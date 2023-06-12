import { Receiver } from 'app/plugins/datasource/alertmanager/types';

export const isInOnCallIntegrations = (url: string, integrationsUrls: string[]) => {
  return integrationsUrls.includes(url);
};

export const isOnCallReceiver = (receiver: Receiver, integrationsUrls: string[]) => {
  if (!receiver.grafana_managed_receiver_configs) {
    return false;
  }
  // A receiver it's an onCall contact point if it includes only one integration, and this integration it's an onCall
  // An integration it's an onCall type if it's included in the list of integrations returned by the onCall api endpoint
  const onlyOneIntegration = receiver.grafana_managed_receiver_configs.length === 1;
  const isOncall = isInOnCallIntegrations(
    receiver.grafana_managed_receiver_configs[0]?.settings?.url ?? '',
    integrationsUrls
  );
  return onlyOneIntegration && isOncall;
};
